const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { getUserData, addUser, checkCompatibilityResponse, addCompatiblityResponse } = require("../database/db");
const { getInstagramProfile, generateAICompatiblityRoast } = require("../helpers/apiHelper");
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

  const withGcsUrl = (userData) => ({
    ...userData,
    profile_pic_url: `https://storage.googleapis.com/${bucketName}/${userData.profile_pic_url}`,
  });

  await assertNotCancelled(jobId);
  await onProgress("checking_cache", "checking if we've compared these two before...");
  let userData1 = await getUserData(uname1);
  let userData2 = await getUserData(uname2);

  if (userData1 && userData2) {
    const check = await checkCompatibilityResponse(userData1.id, userData2.id, language);
    if (check.success) {
      return {
        userData1: withGcsUrl(userData1),
        userData2: withGcsUrl(userData2),
        compatibilityText: check.compatibilityText,
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
  await onProgress("generating_roast", "asking the AI to judge this match-up...");
  const { id: _id1, profile_pic_url: _pic1, ...promptData1 } = userData1;
  const { id: _id2, profile_pic_url: _pic2, ...promptData2 } = userData2;
  const compatibilityText = await generateAICompatiblityRoast(promptData1, promptData2, language);

  await assertNotCancelled(jobId);
  await onProgress("saving_roast", "saving the verdict...");
  await addCompatiblityResponse(userData1.username, userData2.username, compatibilityText, language);

  return {
    userData1: withGcsUrl(userData1),
    userData2: withGcsUrl(userData2),
    compatibilityText,
  };
}

module.exports = { processCompatibilityRoastJob };
