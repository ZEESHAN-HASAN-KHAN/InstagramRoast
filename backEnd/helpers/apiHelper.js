require("dotenv").config();
const { callLLM } = require("./llmProvider");
const logger = require("./logger");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Thrown when a source directly confirms the account doesn't exist (as opposed
// to being rate-limited/unreachable), so callers can show a "not found" message
// instead of a generic failure.
class ProfileNotFoundError extends Error {
  constructor(username) {
    super(`Instagram profile @${username} not found`);
    this.name = "ProfileNotFoundError";
  }
}

const getRapidAPIKeys = () => {
  const multi = process.env.X_RAPIDAPI_KEYS;
  if (multi) return multi.split(",").map((k) => k.trim()).filter(Boolean);
  const single = process.env.X_RAPIDAPI_KEY;
  if (single) return [single];
  return [];
};

// Final fallback: self-hosted Playwright scraper on Cloud Run. Used only when
// every RapidAPI key has failed. Returns the same shape as getInstagramProfile.
const getInstagramProfileFromScrapper = async (username) => {
  const base = process.env.SCRAPPER_FALLBACK_URL;
  if (!base) throw new Error("SCRAPPER_FALLBACK_URL not configured");

  const url = `${base.replace(/\/$/, "")}/profile/${encodeURIComponent(username)}`;
  const response = await fetch(url, { method: "GET" });

  logger.info(`[Instagram API] Scrapper fallback responded`, { status: response.status });

  if (response.status === 404) {
    throw new ProfileNotFoundError(username);
  }

  if (!response.ok) {
    throw new Error(`Scrapper fallback failed with status ${response.status}`);
  }

  const result = await response.json();
  return {
    full_name: result.full_name,
    username: result.username,
    follower: result.follower_count,
    following: result.following_count,
    isPrivate: result.is_private ?? false,
    biography: result.biography,
    post: result.media_count,
    profile_pic_url: result.profile_pic_url_hd,
  };
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

  // All RapidAPI keys exhausted — try the self-hosted scrapper as last resort.
  logger.warning(`[Instagram API] All RapidAPI keys failed, trying scrapper fallback`, { errors });
  try {
    return await getInstagramProfileFromScrapper(username);
  } catch (err) {
    if (err instanceof ProfileNotFoundError) throw err;
    logger.error(`[Instagram API] Scrapper fallback threw`, { error: err.message });
    errors.push({ source: "scrapper", error: err.message });
  }

  throw new Error(`All profile sources failed: ${JSON.stringify(errors)}`);
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
- Use emojis for emphasis in the body only — never on line 1.
- Write strictly in ${JSON.stringify(language)} and output in **markdown format**.

STRICT RULES — violating any of these will make the output unusable:
- NO titles, headers, or labels (e.g. do NOT write "Compatibility Roast", "Roast", "#HotTake", etc.)
- NO sign-offs, closings, or sign-ins (e.g. do NOT write "— your AI bestie", "Sincerely", etc.)
- NO compliments, praise, motivation, or kind words of any kind.
- NO meta-commentary like "Here is your roast:" or "Sure! Here's a roast:"
- Start the roast IMMEDIATELY. The very first word must be part of the roast itself.
- The response must contain ONLY the roast text in markdown. Nothing else.

OUTPUT SHAPE — the last and most important rule. Get this wrong and the whole roast is discarded:
- LINE 1 is ONE short sentence: the most quotable, screenshot-worthy line of the whole roast. It gets printed alone on a shareable card, so it has to land with no context around it.
- Line 1 is 40 to 130 characters. Count them before you answer. Over 130 and it is thrown away.
- Line 1 has ZERO emoji, no markdown, no surrounding quotation marks, no name prefix like "Dave:".
- Line 1 is the opening of the roast, not a title and not a summary of what follows. Aim it at these two specifically — a line that would fit any couple is a failure.
- Then a blank line.
- Then the rest of the roast, which must NOT repeat line 1. The compatibility score goes in the body, never on line 1.

The shape, illustrated — never reuse these words, only this layout:
One of you peaked in a group photo and the other one cropped it.

Two personalities, one shared brain cell, and it is off duty. Compatibility: 3/10. 💀
`;
  logger.debug("LLM input prompt", { prompt: inputPrompt });
  return callLLM(inputPrompt);
};

// Angles a re-roast can be pushed down. Sampling one keeps a paid re-roast from
// landing on the same jokes as the roast it replaced — temperature alone tends
// to circle the same two or three observations about a profile.
const REROAST_ANGLES = [
  "their follower-to-following ratio and what it says about them",
  "their bio and how hard it is trying",
  "how they look in the profile picture",
  "their post count versus how important they think they are",
  "the gap between the life they're advertising and the one they have",
  "their username itself",
];

const generateAIRoast = async (userData, profileUrl, language, { freshAngle = false } = {}) => {
  const angleInstruction = freshAngle
    ? `\n  - This person has been roasted before and paid for another one. Do NOT repeat the obvious observations. Build this roast around ${REROAST_ANGLES[Math.floor(Math.random() * REROAST_ANGLES.length)]}, and land somewhere the last roast wouldn't have.`
    : "";

  const inputPrompt = `
  You are a thug roadside comedian abusive in nature. Your task is to roast an Instagram user based on their profile in a clever, ruthless, and darkly funny way.

  Instructions:
  - Base your roast on the following user data: ${JSON.stringify(
    userData,
  )} and the image attached.${angleInstruction}
  - Be as sarcastic, blunt, and edgy as possible. Use clever wordplay and savage humor.
  - Be as sarcastic, blunt, and edgy as possible. Use clever wordplay and savage humor.
  - Keep the roast concise (under 100 words).
  - Use emojis for emphasis in the body only — never on line 1.
  - Write strictly in ${language} and output in **markdown format**.

  STRICT RULES — violating any of these will make the output unusable:
  - NO titles, headers, or labels (e.g. do NOT write "Roast", "Hot Take", "#Roast", etc.)
  - NO sign-offs, closings, or sign-ins (e.g. do NOT write "— your AI bestie", "Sincerely", "Love,", etc.)
  - NO compliments, praise, motivation, or kind words of any kind.
  - NO meta-commentary like "Here is your roast:" or "Sure! Here's a roast:"
  - Start the roast IMMEDIATELY. The very first word must be part of the roast itself.
  - The response must contain ONLY the roast text in markdown. Nothing else.

  OUTPUT SHAPE — the last and most important rule. Get this wrong and the whole roast is discarded:
  - LINE 1 is ONE short sentence: the most quotable, screenshot-worthy line of the whole roast. It gets printed alone on a shareable card, so it has to land with no context around it.
  - Line 1 is 40 to 130 characters. Count them before you answer. Over 130 and it is thrown away.
  - Line 1 has ZERO emoji, no markdown, no surrounding quotation marks, no name prefix like "Dave:".
  - Line 1 is the opening of the roast, not a title and not a summary of what follows. Aim it at this person — a line that would fit any profile is a failure.
  - Then a blank line.
  - Then the rest of the roast, which must NOT repeat line 1.

  The shape, illustrated — never reuse these words, only this layout:
  Your bio is a personality test you failed twice and still framed it.

  Three hundred followers, four hundred following, and not one of them would help you move. 📉
`;

  logger.debug("LLM input prompt", { prompt: inputPrompt });
  return callLLM(inputPrompt, profileUrl);
};

module.exports = {
  getInstagramProfile,
  generateAIRoast,
  generateAICompatiblityRoast,
  ProfileNotFoundError,
};
