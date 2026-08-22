const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { getUserData, addUser, checkCompatibilityResponse, addCompatiblityResponse } = require("../database/db");
const { getInstagramProfile, generateAICompatiblityRoast } = require("../helpers/apiHelper");
const { generateCosmicMatch } = require("../helpers/cosmicMatch");
const { signForDate, SIGN_META } = require("../helpers/zodiac");
const { uploadImage } = require("../helpers/storageHelper");
const { assertNotCancelled } = require("./processSingleRoastJob");

async function ensureProfile(username, jobId, onProgress, label) {
  let profile = await getUserData(username);
  if (profile) return profile;

  await assertNotCancelled(jobId);
  await onProgress(`scraping_profile_${label}`, `scraping @${username}'s Instagram profile...`);
  const scraped = await getInstagramProfile(username);
  if (!scraped.username) throw new Error("Invalid user data: username is null");

  await assertNotCancelled(jobId);
  await onProgress(`uploading_image_${label}`, `grabbing @${username}'s profile picture...`);
  const imageResponse = await fetch(scraped.profile_pic_url);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch profile picture: ${imageResponse.statusText}`);
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const fileName = await uploadImage(imageBuffer);

  await onProgress(`saving_profile_${label}`, `saving @${username}'s profile data...`);
  await addUser(
    fileName,
    scraped.username,
    scraped.full_name,
    scraped.follower,
    scraped.following,
    scraped.biography,
    scraped.post
  );

  return {
    id: undefined, // freshly inserted row's id isn't needed below; addCompatiblityResponse looks it up by username
    profile_pic_url: fileName,
    username: scraped.username,
    full_name: scraped.full_name,
    follower: scraped.follower,
    following: scraped.following,
    biography: scraped.biography,
    post: scraped.post,
  };
}

// Reuses the existing scrape -> upload -> persist -> compatibility-LLM pipeline
// unchanged; only stage reporting and cancellation checks around it are new.
async function processCompatibilityRoastJob(job, { onProgress }) {
  const { id: jobId, username: uname1, username_2: uname2, language } = job;
  const bucketName = process.env.BUCKET_NAME;

  // DATE columns come back as plain "YYYY-MM-DD" strings; see the type parser
  // in database/db.js for why. The Date branch is a belt-and-braces fallback
  // for any connection that did not go through that module.
  //
  // It reads LOCAL parts, not UTC ones. node-postgres builds a DATE's Date
  // object at local midnight, so the local parts are the true stored date and
  // the UTC parts are shifted a day backwards anywhere east of Greenwich. An
  // earlier version of this function used the UTC parts and moved every
  // birthday back one day.
  const asDateString = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value.slice(0, 10);
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const dob1 = asDateString(job.birth_date_1);
  const dob2 = asDateString(job.birth_date_2);
  // One date is enough to run the astrology framing — the prompt has a line for
  // the person who would not say. Zero dates means this is a plain pairing and
  // takes the original compatibility path.
  const isCosmic = Boolean(dob1 || dob2);

  const withGcsUrl = (userData) => ({
    ...userData,
    profile_pic_url: `https://storage.googleapis.com/${bucketName}/${userData.profile_pic_url}`,
  });

  await assertNotCancelled(jobId);
  await onProgress("checking_cache", "checking if we've compared these two before...");
  let userData1 = await getUserData(uname1);
  let userData2 = await getUserData(uname2);

  if (userData1 && userData2) {
    const check = await checkCompatibilityResponse(userData1.id, userData2.id, language, dob1, dob2);
    if (check.success) {
      return {
        userData1: withGcsUrl(userData1),
        userData2: withGcsUrl(userData2),
        compatibilityText: check.compatibilityText,
        ...cosmicFieldsFrom(check),
      };
    }
  }

  if (!userData1) userData1 = await ensureProfile(uname1, jobId, onProgress, "1");
  // Push each profile to the frontend as soon as it's resolved (cache hit or
  // freshly scraped) so it can render progressively instead of waiting for
  // both profiles and the compatibility text.
  await onProgress("profile_1_ready", `got @${uname1}'s profile...`, { userData1: withGcsUrl(userData1) });

  if (!userData2) userData2 = await ensureProfile(uname2, jobId, onProgress, "2");
  await onProgress("profile_2_ready", `got @${uname2}'s profile — judging this match-up...`, { userData2: withGcsUrl(userData2) });

  await assertNotCancelled(jobId);
  await onProgress(
    "generating_roast",
    isCosmic ? "consulting the stars about this one..." : "asking the AI to judge this match-up..."
  );
  const { id: _id1, profile_pic_url: _pic1, ...promptData1 } = userData1;
  const { id: _id2, profile_pic_url: _pic2, ...promptData2 } = userData2;

  // Two shapes out of one call site: the cosmic path returns a parsed object,
  // the legacy path a bare string. Normalised here so everything below — cache
  // write, job result, frontend — sees the same fields either way.
  const match = isCosmic
    ? await generateCosmicMatch(promptData1, promptData2, language, dob1, dob2)
    : { text: await generateAICompatiblityRoast(promptData1, promptData2, language) };

  const compatibilityText = match.text;

  await assertNotCancelled(jobId);
  await onProgress("saving_roast", "saving the verdict...");
  await addCompatiblityResponse(userData1.username, userData2.username, compatibilityText, language, {
    score: match.score ?? null,
    greenFlag: match.greenFlag ?? null,
    redFlag: match.redFlag ?? null,
    verdict: match.verdict ?? null,
    birthDate1: dob1,
    birthDate2: dob2,
    sign1: match.sign1?.name ?? signForDate(dob1)?.name ?? null,
    sign2: match.sign2?.name ?? signForDate(dob2)?.name ?? null,
  });

  return {
    userData1: withGcsUrl(userData1),
    userData2: withGcsUrl(userData2),
    compatibilityText,
    score: match.score ?? null,
    greenFlag: match.greenFlag ?? null,
    redFlag: match.redFlag ?? null,
    verdict: match.verdict ?? null,
    sign1: match.sign1 ?? null,
    sign2: match.sign2 ?? null,
  };
}

// A cached row stores the sign as a bare name; the live path returns the full
// object the UI renders (name + glyph + element). Rehydrated from zodiac.js so
// a cache hit and a fresh run are indistinguishable on screen.
function cosmicFieldsFrom(row) {
  const hydrate = (name) => {
    if (!name) return null;
    const meta = SIGN_META[name];
    return meta ? { name, emoji: meta.emoji, element: meta.element } : { name };
  };
  return {
    score: row.score ?? null,
    greenFlag: row.greenFlag ?? null,
    redFlag: row.redFlag ?? null,
    verdict: row.verdict ?? null,
    sign1: hydrate(row.sign1),
    sign2: hydrate(row.sign2),
  };
}

module.exports = { processCompatibilityRoastJob };
