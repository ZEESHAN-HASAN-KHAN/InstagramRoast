require("dotenv").config();
const OpenAI = require("openai");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const logger = require("./logger");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const GEMINI_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// A roast is ~100 words. Anything beyond this is a model rambling, and on
// providers that bill/limit by tokens-per-minute an uncapped request can be
// rejected outright — so every provider gets an explicit ceiling.
const DEFAULT_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 1024;

const PROVIDER_CONFIGS = {
  gemini: {
    apiKey: () => process.env.GEMINI_API_KEY,
    model: () => process.env.GEMINI_MODEL || "gemini-2.5-flash",
    supportsVision: true,
  },
  "gpt-4o-mini": {
    baseURL: undefined,
    apiKey: () => process.env.OPENAI_API_KEY,
    model: () => process.env.OPENAI_MODEL || "gpt-4o-mini",
    supportsVision: true,
  },
  deepseek: {
    baseURL: "https://api.deepseek.com",
    apiKey: () => process.env.DEEPSEEK_API_KEY,
    model: () => process.env.DEEPSEEK_MODEL || "deepseek-chat",
    supportsVision: false,
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
    supportsVision: true,
    // Reasoning models (qwen3, deepseek-r1, ...) spend the whole completion
    // budget on chain-of-thought and leave nothing for the roast — the response
    // then comes back truncated mid-sentence or empty. Thinking is off by
    // default; set GROQ_REASONING_EFFORT=default to turn it back on.
    // "hidden" keeps whatever thinking does happen out of the message body.
    extraParams: () => ({
      reasoning_effort: process.env.GROQ_REASONING_EFFORT || "none",
      reasoning_format: process.env.GROQ_REASONING_FORMAT || "hidden",
    }),
  },
};

// Reasoning models (qwen3, deepseek-r1, ...) can leak their scratchpad into the
// message body. Strip it so only the roast survives.
const stripReasoning = (text) => {
  if (typeof text !== "string") return text;
  return text
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    // Unclosed opening tag: model got cut off mid-thought, drop everything after.
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/gi, "")
    // Leading orphan close tag when the opening tag was never emitted.
    .replace(/^[\s\S]*?<\/(think|thinking|reasoning)>/gi, "")
    .trim();
};

const getProviderOrder = () => {
  const raw = process.env.LLM_PROVIDER_ORDER || "gemini,gpt-4o-mini,deepseek";
  return raw.split(",").map((p) => p.trim().toLowerCase());
};

const callGemini = async (config, prompt, imageUrl) => {
  const genAI = new GoogleGenerativeAI(config.apiKey());
  const model = genAI.getGenerativeModel({
    model: config.model(),
    generationConfig: {
      temperature: 1.5,
      maxOutputTokens: DEFAULT_MAX_TOKENS,
      // 2.5-* models think by default and bill it against the same budget as
      // the answer. The roast needs no reasoning, so spend it all on output.
      ...(process.env.GEMINI_THINKING === "on" ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
    safetySettings: GEMINI_SAFETY_SETTINGS,
  });

  const parts = [prompt];
  if (imageUrl) {
    const imageResponse = await fetch(imageUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    parts.push({ inlineData: { data: base64Image, mimeType: "image/jpeg" } });
  }

  const result = await model.generateContent(parts);
  const finishReason = result.response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    // MAX_TOKENS / SAFETY / RECITATION all mean the text is cut short or
    // missing. Throwing hands the roast to the next provider in the order.
    throw new Error(`Gemini stopped early (finishReason=${finishReason})`);
  }
  return result.response.text();
};

// Groq (and other OpenAI-compatible hosts) reject params their model doesn't
// support with a 400 rather than ignoring them, so a config tuned for a
// reasoning model would hard-fail the moment the model env var changes.
const isUnsupportedParamError = (err) =>
  err?.status === 400 && /reasoning_effort|reasoning_format|unsupported|must be one of/i.test(err?.message || "");

const callOpenAICompat = async (config, prompt, imageUrl) => {
  const clientOptions = { apiKey: config.apiKey() };
  if (config.baseURL) clientOptions.baseURL = config.baseURL;

  const client = new OpenAI(clientOptions);
  const content = [{ type: "text", text: prompt }];
  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const baseParams = {
    model: config.model(),
    messages: [{ role: "user", content }],
    max_completion_tokens: DEFAULT_MAX_TOKENS,
  };

  let completion;
  try {
    completion = await client.chat.completions.create({
      ...baseParams,
      ...(config.extraParams ? config.extraParams() : {}),
    });
  } catch (err) {
    if (!isUnsupportedParamError(err)) throw err;
    logger.warning(`[LLM] Provider rejected tuning params, retrying without them`, { model: config.model(), error: err.message });
    completion = await client.chat.completions.create(baseParams);
  }

  const choice = completion.choices[0];
  if (choice.finish_reason === "length") {
    // Budget exhausted before the model finished — whatever came back is a
    // half-sentence (or, on a reasoning model, only chain-of-thought).
    throw new Error(`Response truncated at max_completion_tokens (${DEFAULT_MAX_TOKENS})`);
  }
  return choice.message.content;
};

/**
 * Call LLM with automatic fallback through configured provider order.
 * @param {string} prompt - Text prompt
 * @param {string|null} imageUrl - Optional image URL; enables vision mode
 */
const callLLM = async (prompt, imageUrl = null) => {
  const order = getProviderOrder();
  const requiresVision = !!imageUrl;
  const errors = [];

  for (const name of order) {
    const config = PROVIDER_CONFIGS[name];
    if (!config) {
      logger.warning(`[LLM] Unknown provider "${name}", skipping`);
      continue;
    }
    if (requiresVision && !config.supportsVision) {
      logger.debug(`[LLM] Skipping "${name}": no vision support`);
      continue;
    }
    const apiKey = config.apiKey();
    if (!apiKey) {
      logger.warning(`[LLM] Skipping "${name}": no API key configured`, { provider: name });
      continue;
    }

    try {
      let result;
      if (name === "gemini") {
        result = await callGemini(config, prompt, imageUrl);
      } else {
        result = await callOpenAICompat(config, prompt, imageUrl);
      }
      const text = stripReasoning(result);
      // An empty body after stripping means the model emitted only reasoning
      // (or nothing at all) — serving that would show the visitor a blank
      // roast, so treat it as a provider failure and fall through.
      if (!text) throw new Error("Empty response after stripping reasoning");
      logger.info(`[LLM] Response from "${name}"`, { provider: name, model: config.model(), chars: text.length });
      return text;
    } catch (err) {
      logger.error(`[LLM] Provider "${name}" failed`, { provider: name, error: err.message });
      errors.push({ provider: name, error: err.message });
    }
  }

  throw new Error(`All LLM providers failed: ${JSON.stringify(errors)}`);
};

module.exports = { callLLM };
