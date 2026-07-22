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
    // Groq-only: "hidden" drops the chain-of-thought from the response body.
    // Only valid for reasoning models, so it stays opt-in via env.
    extraParams: () =>
      process.env.GROQ_REASONING_FORMAT
        ? { reasoning_format: process.env.GROQ_REASONING_FORMAT }
        : {},
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
    generationConfig: { temperature: 1.5 },
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
  return result.response.text();
};

const callOpenAICompat = async (config, prompt, imageUrl) => {
  const clientOptions = { apiKey: config.apiKey() };
  if (config.baseURL) clientOptions.baseURL = config.baseURL;

  const client = new OpenAI(clientOptions);
  const content = [{ type: "text", text: prompt }];
  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const completion = await client.chat.completions.create({
    model: config.model(),
    messages: [{ role: "user", content }],
    ...(config.extraParams ? config.extraParams() : {}),
  });
  return completion.choices[0].message.content;
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
      logger.info(`[LLM] Response from "${name}"`, { provider: name, model: config.model() });
      return stripReasoning(result);
    } catch (err) {
      logger.error(`[LLM] Provider "${name}" failed`, { provider: name, error: err.message });
      errors.push({ provider: name, error: err.message });
    }
  }

  throw new Error(`All LLM providers failed: ${JSON.stringify(errors)}`);
};

module.exports = { callLLM };
