require("dotenv").config();

const { Storage } = require("@google-cloud/storage");
const { mintCard } = require("./cardIdentity");
const { renderOgCard } = require("./ogCard");
const { getUserData, getAIResponse } = require("../database/db");
const { isIndexable } = require("../database/sitemap");
const logger = require("./logger");

// Rendered link-preview images live in their own bucket, separate from the
// scraped avatars. Nothing here is served to the public directly — the bucket
// is a private cache and the bytes go out through the route in routes/og.js.
// That keeps the bucket from needing an allUsers grant, and means a preview
// costs one render per roast rather than one per crawler hit (Facebook,
// WhatsApp, Twitter and Slack all fetch the same URL separately).
const MEDIA_BUCKET = process.env.MEDIA_BUCKET_NAME;
const AVATAR_BUCKET = process.env.BUCKET_NAME;

let storage;
function getStorage() {
  if (!storage) storage = new Storage();
  return storage;
}

async function loadRoast(username, language) {
  const profile = await getUserData(username);
  if (!profile) return null;
  const row = await getAIResponse(username, language);
  if (!row || !row.response_text) return null;
  return { profile, roast: row.response_text };
}

/**
 * Returns the link-preview JPEG for a roast, rendering it on first request and
 * reusing the stored copy afterwards.
 *
 * The cache key includes the card serial, which is derived from the roast text.
 * A re-roast therefore lands on a new key instead of serving a stale image, and
 * no invalidation step is needed anywhere.
 *
 * @returns {Promise<{buffer: Buffer, identity: object, profile: object, cached: boolean}|null>}
 *   null when the profile or its roast does not exist.
 */
async function ensureOgImage(username, language) {
  const found = await loadRoast(username, language);
  if (!found) return null;

  const { profile, roast } = found;
  const identity = mintCard(profile.username, roast);
  const key = `og/${profile.username}/${language}-${identity.serial}.jpg`;

  const file = MEDIA_BUCKET ? getStorage().bucket(MEDIA_BUCKET).file(key) : null;

  if (file) {
    try {
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        return { buffer, identity, profile, cached: true };
      }
    } catch (err) {
      // A cache that is down is not a reason to serve no preview.
      logger.warning("[og] cache read failed, rendering fresh", { error: err.message });
    }
  }

  const buffer = await renderOgCard({
    identity,
    profile: {
      handle: profile.username,
      displayName: profile.full_name,
      avatarUrl: profile.profile_pic_url
        ? `https://storage.googleapis.com/${AVATAR_BUCKET}/${profile.profile_pic_url}`
        : "",
    },
  });

  if (file) {
    // Not awaited: the requester should not wait on the cache write, and a
    // failed write only costs a re-render next time.
    file
      .save(buffer, {
        metadata: {
          contentType: "image/jpeg",
          cacheControl: "public, max-age=31536000, immutable",
        },
      })
      .catch((err) => logger.warning("[og] cache write failed", { error: err.message }));
  }

  return { buffer, identity, profile, cached: false };
}

/** Metadata the frontend injects into <head> so crawlers see the real roast. */
async function ensureOgMeta(username, language, origin) {
  const found = await loadRoast(username, language);
  if (!found) return null;

  const { profile, roast } = found;
  const identity = mintCard(profile.username, roast);
  const langSuffix = language === "english" ? "" : `?language=${encodeURIComponent(language)}`;

  return {
    username: profile.username,
    title: `@${profile.username} pulled a ${identity.rarity.name} roast card`,
    // The punchline itself is the description — a preview that shows the joke
    // is the reason anyone taps through.
    description: identity.headline
      ? `"${identity.headline}" — ${identity.rarity.pullRate}% pull rate. Get your own roast card.`
      : `AI-roasted on InstaRoasts. ${identity.rarity.pullRate}% pull rate.`,
    image: `${origin}/api/v1/og-image/${encodeURIComponent(profile.username)}.jpg${langSuffix}`,
    rarity: identity.rarity.id,
    serial: identity.serial,
    // Decided here rather than in the frontend so the robots tag on the page and
    // the sitemap's contents can never disagree. The frontend already fetches
    // this payload for every /:username request, so it costs no extra round trip.
    indexable: isIndexable(profile),
  };
}

module.exports = { ensureOgImage, ensureOgMeta };
