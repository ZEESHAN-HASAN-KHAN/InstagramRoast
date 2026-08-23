require("dotenv").config();
const { callLLM } = require("./llmProvider");
const logger = require("./logger");
const { buildPrompt, loadTemplate } = require("./prompts");

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
  const inputPrompt = buildPrompt("PROMPT_COMPAT_ROAST", {
    profile1: JSON.stringify(userData1),
    profile2: JSON.stringify(userData2),
    // Quoted, unlike every other prompt's language slot. That is what the
    // inline template did before this moved to .env, and a refactor is the
    // wrong moment to also change what the model reads.
    language: JSON.stringify(language),
  });
  logger.debug("LLM input prompt", { prompt: inputPrompt });
  return callLLM(inputPrompt);
};

// Angles a re-roast can be pushed down. Sampling one keeps a paid re-roast from
// landing on the same jokes as the roast it replaced — temperature alone tends
// to circle the same two or three observations about a profile.
//
// The list itself is prompt text, so it lives in PROMPT_ROAST_ANGLES (one angle
// per line) rather than here, and the sentence that wraps the chosen one is
// PROMPT_ROAST_REROLL with an {{angle}} placeholder. Only the coin flip and the
// line-splitting are code.
const pickReroastAngle = () => {
  const angles = loadTemplate("PROMPT_ROAST_ANGLES")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (angles.length === 0) throw new Error("PROMPT_ROAST_ANGLES is empty");
  return angles[Math.floor(Math.random() * angles.length)];
};

const generateAIRoast = async (userData, profileUrl, language, { freshAngle = false } = {}) => {
  // A normal roast substitutes an empty string here, so the template carries
  // the re-roast wording and this file never states it.
  const angleInstruction = freshAngle
    ? buildPrompt("PROMPT_ROAST_REROLL", { angle: pickReroastAngle() })
    : "";

  const inputPrompt = buildPrompt("PROMPT_ROAST", {
    profile: JSON.stringify(userData),
    angleInstruction,
    language,
  });

  logger.debug("LLM input prompt", { prompt: inputPrompt });
  return callLLM(inputPrompt, profileUrl);
};

module.exports = {
  getInstagramProfile,
  generateAIRoast,
  generateAICompatiblityRoast,
  ProfileNotFoundError,
};
