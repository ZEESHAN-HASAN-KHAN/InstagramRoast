const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { getUserData, getAIResponse, addUser, addAIResponse } = require("../database/db");
const { getInstagramProfile, generateAIRoast } = require("../helpers/apiHelper");
const { uploadImage } = require("../helpers/storageHelper");
const { isCancellationRequested } = require("../database/roastJobs");
const { recordProfileView } = require("../database/engagement");

class JobCancelledError extends Error {
  constructor() {
    super("Job cancelled");
    this.cancelled = true;
  }
}

async function assertNotCancelled(jobId) {
  if (await isCancellationRequested(jobId)) throw new JobCancelledError();
}

// Reuses the existing scrape -> upload -> persist pipeline unchanged; only the
// stage reporting and cancellation checks around it are new.
async function processSingleRoastJob(job, { onProgress }) {
  const { id: jobId, username, language } = job;
  const bucketName = process.env.BUCKET_NAME;
  const roasterGeo = {
    country: job.roaster_country ?? null,
    region: job.roaster_region ?? null,
    city: job.roaster_city ?? null,
  };

  await assertNotCancelled(jobId);
  await onProgress("checking_cache", "checking if we've roasted this one before...");
  let profile = await getUserData(username);
  let llmImageUrl;

  if (!profile) {
    await assertNotCancelled(jobId);
    await onProgress("scraping_profile", `scraping @${username}'s Instagram profile...`);
    const scraped = await getInstagramProfile(username);
    llmImageUrl = scraped.profile_pic_url;

    await assertNotCancelled(jobId);
    await onProgress("uploading_image", "grabbing the profile picture...");
    const imageResponse = await fetch(scraped.profile_pic_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch profile picture: ${imageResponse.statusText}`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const fileName = await uploadImage(imageBuffer);

    await onProgress("saving_profile", "saving profile data...");
    const saved = await addUser(
      fileName,
      scraped.username,
      scraped.full_name,
      scraped.follower,
      scraped.following,
      scraped.biography,
      scraped.post
    );

    profile = {
      id: saved.id,
      profile_pic_url: fileName,
      username: scraped.username,
      full_name: scraped.full_name,
      follower: scraped.follower,
      following: scraped.following,
      biography: scraped.biography,
      post: scraped.post,
    };
  }

  const gcsProfileUrl = `https://storage.googleapis.com/${bucketName}/${profile.profile_pic_url}`;
  if (!llmImageUrl) llmImageUrl = gcsProfileUrl;

  // The route counts views on the cached path; this covers the other one, so a
  // freshly generated roast (and every paid re-roast) lands on the board too.
  // No client IP reaches the worker, so a session-less job is keyed by its own
  // id — one generation, one viewer.
  recordProfileView(profile.id, roasterGeo, {
    sessionId: job.session_id ?? null,
    ip: `job:${jobId}`,
  });

  // Profile is fully resolved at this point (cache hit or freshly scraped) —
  // push it to the frontend now so it can render the real profile card while
  // the roast itself is still being generated.
  await onProgress("profile_ready", `got @${username}'s profile — cooking up the roast...`, {
    insta_data: { ...profile, profile_pic_url: gcsProfileUrl },
  });

  await assertNotCancelled(jobId);
  // A re-roast is precisely a request NOT to reuse what's cached — it was paid
  // for, so it always goes to the LLM.
  let roastText = job.force_regenerate
    ? null
    : (await getAIResponse(profile.username, language))?.response_text;

  if (!roastText) {
    await onProgress("generating_roast", "asking the AI to roast you...");
    const { profile_pic_url, ...profileForPrompt } = profile;
    roastText = await generateAIRoast(profileForPrompt, llmImageUrl, language, {
      freshAngle: !!job.force_regenerate,
    });

    await assertNotCancelled(jobId);
    await onProgress("saving_roast", "saving your roast...");
    // Appends a new row rather than replacing: getAIResponse serves newest-first,
    // so this becomes the roast everyone sees while the old one stays for history.
    await addAIResponse(profile.username, roastText, language, roasterGeo);
  }

  return {
    insta_data: { ...profile, profile_pic_url: gcsProfileUrl },
    data: roastText,
  };
}

module.exports = { processSingleRoastJob, JobCancelledError, assertNotCancelled };
