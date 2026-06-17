require("dotenv").config();
const { callLLM } = require("./llmProvider");
const logger = require("./logger");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const getRapidAPIKeys = () => {
  const multi = process.env.X_RAPIDAPI_KEYS;
  if (multi) return multi.split(",").map((k) => k.trim()).filter(Boolean);
  const single = process.env.X_RAPIDAPI_KEY;
  if (single) return [single];
  return [];
};

const getInstagramProfile = async (username) => {
  const keys = getRapidAPIKeys();
  if (keys.length === 0) throw new Error("No RapidAPI keys configured");

  const url = new URL(`${process.env.URL}` + "/v1/info");
  url.searchParams.append("username_or_id_or_url", username);
  const errors = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-rapidapi-key": key,
          "x-rapidapi-host": process.env.X_RAPIDAPI_HOST,
        },
      });

      logger.info(`[Instagram API] Key ${i + 1}/${keys.length} responded`, { keyIndex: i + 1, status: response.status });

      if (response.status === 429 || response.status === 403) {
        logger.warning(`[Instagram API] Key ${i + 1} rate-limited/forbidden, trying next`, { keyIndex: i + 1, status: response.status });
        errors.push({ key: i + 1, status: response.status });
        continue;
      }

      const data = await response.json();

      if (!response.ok || !data.data) {
        logger.warning(`[Instagram API] Key ${i + 1} bad response`, { keyIndex: i + 1, status: response.status, body: data });
        errors.push({ key: i + 1, status: response.status, body: data });
        continue;
      }

      const result = data.data;
      return {
        full_name: result.full_name,
        username: result.username,
        follower: result.follower_count,
        following: result.following_count,
        isPrivate: result.is_private,
        biography: result.biography,
        post: result.media_count,
        profile_pic_url: result.profile_pic_url_hd,
      };
    } catch (err) {
      logger.error(`[Instagram API] Key ${i + 1} threw`, { keyIndex: i + 1, error: err.message });
      errors.push({ key: i + 1, error: err.message });
    }
  }

  throw new Error(`All RapidAPI keys failed: ${JSON.stringify(errors)}`);
};

const generateAICompatiblityRoast = async (userData1, userData2, language) => {
  const inputPrompt = `You are a professional comedian with a reputation for razor-sharp wit and dark humor. Your task is to write a humorous and personalized compability roast for two person that teases their quirks, contrasts, and similarities.
If the profiles are of opposite genders, add a witty take on their potential compatibility (or lack thereof) with a relationship dynamic.
User 1:
${JSON.stringify(userData1)}
User 2:
${JSON.stringify(userData2)}
  Instructions:
- Be as sarcastic, blunt, and edgy as possible. Use clever wordplay and savage humor.
- Use personalized taunts and playful jabs.
- Be as sarcastic, blunt, and edgy as possible. Use clever wordplay and savage humor.
- Keep the roast concise (under 100 words).
- Add a compatibility score with humor out of 10.
- Use emojis for emphasis.
- Write strictly in ${JSON.stringify(language)} and output in **markdown format**.

STRICT RULES — violating any of these will make the output unusable:
- NO titles, headers, or labels (e.g. do NOT write "Compatibility Roast", "Roast", "#HotTake", etc.)
- NO sign-offs, closings, or sign-ins (e.g. do NOT write "— your AI bestie", "Sincerely", etc.)
- NO compliments, praise, motivation, or kind words of any kind.
- NO meta-commentary like "Here is your roast:" or "Sure! Here's a roast:"
- Start the roast IMMEDIATELY. The very first word must be part of the roast itself.
- The response must contain ONLY the roast text in markdown. Nothing else.
`;
  logger.debug("LLM input prompt", { prompt: inputPrompt });
  return callLLM(inputPrompt);
};

const generateAIRoast = async (userData, profileUrl, language) => {
  const inputPrompt = `
  You are a thug roadside comedian abusive in nature. Your task is to roast an Instagram user based on their profile in a clever, ruthless, and darkly funny way.

  Instructions:
  - Base your roast on the following user data: ${JSON.stringify(
    userData,
  )} and the image attached.
  - Be as sarcastic, blunt, and edgy as possible. Use clever wordplay and savage humor.
  - Be as sarcastic, blunt, and edgy as possible. Use clever wordplay and savage humor.
  - Keep the roast concise (under 100 words).
  - Use emojis for emphasis.
  - Write strictly in ${language} and output in **markdown format**.

  STRICT RULES — violating any of these will make the output unusable:
  - NO titles, headers, or labels (e.g. do NOT write "Roast", "Hot Take", "#Roast", etc.)
  - NO sign-offs, closings, or sign-ins (e.g. do NOT write "— your AI bestie", "Sincerely", "Love,", etc.)
  - NO compliments, praise, motivation, or kind words of any kind.
  - NO meta-commentary like "Here is your roast:" or "Sure! Here's a roast:"
  - Start the roast IMMEDIATELY. The very first word must be part of the roast itself.
  - The response must contain ONLY the roast text in markdown. Nothing else.
`;

  logger.debug("LLM input prompt", { prompt: inputPrompt });
  return callLLM(inputPrompt, profileUrl);
};

module.exports = {
  getInstagramProfile,
  generateAIRoast,
  generateAICompatiblityRoast,
};
