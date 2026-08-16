const express = require("express");
const engagementRouter = express.Router();
const logger = require("../helpers/logger");
const { getUserData, getCardTierCounts, getAIResponse } = require("../database/db");
const {
  upsertRating,
  getLatestResponseId,
  getRatingStats,
  getRecentRoasts,
  getLeaderboard,
  pruneOldViews,
  viewerKeyFor,
  hasRevealedCard,
  recordCardReveal,
  SCOPES,
  RANGES,
} = require("../database/engagement");

// Same identity a view is counted under, so one person is one person across
// both features.
const voterKeyFor = (req) =>
  viewerKeyFor({ sessionId: req.roastSession?.id ?? null, ip: req.clientIp });

function parseScope(value) {
  return SCOPES.includes(value) ? value : "global";
}

// Defaults to the rolling window — that's what every existing link and the
// homepage embed expect to get back when they don't ask.
function parseRange(value) {
  return RANGES.includes(value) ? value : "day";
}

const FEED_LIMIT = 15;
// Ceiling on the caller-supplied limit so a crafted request can't ask for the
// whole table.
const MAX_FEED_LIMIT = 48;

// The feed and both boards are identical for everyone in a scope and get hit on
// every home-page load, so they're served from a short-lived memory cache rather
// than aggregating over the whole table per visitor. A minute stale is invisible
// on a "roasted 2 minutes ago" ticker.
const CACHE_TTL_MS = Number(process.env.ENGAGEMENT_CACHE_TTL_MS) || 60_000;
const cache = new Map();

async function cached(key, produce) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await produce();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });

  // The key space is bounded by (scope × geo), which is effectively unbounded
  // across a global audience — drop expired entries whenever it grows.
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
  }
  return value;
}

// Cache key must include the geo the cascade will resolve against, not just the
// requested scope: two visitors both asking for "near" get different answers.
function geoKey(scope, geo = {}) {
  const { country = "", region = "", city = "" } = geo || {};
  if (scope === "global") return "global";
  return `${scope}|${country}|${region}|${city}`;
}

const bucketUrl = (fileName) =>
  fileName ? `https://storage.googleapis.com/${process.env.BUCKET_NAME}/${fileName}` : null;

const toProfileRow = (row) => ({
  ...row,
  profile_pic_url: bucketUrl(row.profile_pic_url),
});

// --- card reveals ------------------------------------------------------------

// The page defaults to english when no ?language= is given, so the card state
// has to be looked up against the same roast the visitor is actually reading.
const ALLOWED_LANGUAGES = (process.env.ALLOWED_LANGUAGE || "english")
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean);

const parseLanguage = (value) =>
  ALLOWED_LANGUAGES.includes(value) ? value : "english";

// Resolves the roast currently on screen for this profile+language, which is
// the thing a card reveal is actually attached to.
async function currentCard(username, language) {
  const roast = await getAIResponse(username, language);
  if (!roast) return null;
  return {
    responseId: roast.id,
    profileId: roast.profile_id,
    tier: roast.card_tier,
    serial: roast.card_serial,
  };
}

engagementRouter.get("/profiles/:username/card", async (req, res) => {
  try {
    const card = await currentCard(req.params.username, parseLanguage(req.query.language));
    if (!card) return res.status(404).json({ message: "No roast for this profile" });

    const revealed = await hasRevealedCard(card.responseId);
    return res.status(200).json({ revealed, tier: card.tier, serial: card.serial });
  } catch (error) {
    logger.error("Error reading card reveal state", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

engagementRouter.post("/profiles/:username/card/reveal", async (req, res) => {
  try {
    const card = await currentCard(req.params.username, parseLanguage(req.body?.language));
    if (!card) return res.status(404).json({ message: "No roast for this profile" });

    const { firstReveal } = await recordCardReveal({
      aiResponseId: card.responseId,
      profileId: card.profileId,
      sessionId: req.roastSession?.id ?? null,
      ip: req.clientIp,
      viewerKey: voterKeyFor(req),
    });

    return res.status(200).json({ revealed: true, firstReveal });
  } catch (error) {
    logger.error("Error recording card reveal", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// --- ratings -----------------------------------------------------------------

engagementRouter.get("/profiles/:username/rating", async (req, res) => {
  try {
    const profile = await getUserData(req.params.username);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const stats = await getRatingStats(profile.id, voterKeyFor(req), req.visitorGeo);
    return res.status(200).json(stats);
  } catch (error) {
    logger.error("Error reading rating stats", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

engagementRouter.post("/profiles/:username/rating", async (req, res) => {
  try {
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be a whole number from 1 to 5" });
    }

    const profile = await getUserData(req.params.username);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const voterKey = voterKeyFor(req);
    await upsertRating({
      profileId: profile.id,
      aiResponseId: await getLatestResponseId(profile.id),
      sessionId: req.roastSession?.id ?? null,
      ip: req.clientIp || "unknown",
      voterKey,
      rating,
      geo: req.visitorGeo,
    });

    // Answer with the recomputed stats so the widget can settle on real numbers
    // straight after its optimistic update.
    const stats = await getRatingStats(profile.id, voterKey, req.visitorGeo);
    return res.status(200).json(stats);
  } catch (error) {
    logger.error("Error saving rating", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// --- discovery ---------------------------------------------------------------

engagementRouter.get("/feed/recent", async (req, res) => {
  try {
    const scope = parseScope(req.query.scope);
    // Browse tabs ask for exactly what they asked for; the ticker lets the
    // backend widen until it has enough to be worth showing.
    const strict = req.query.strict === "1";
    const limit = Math.min(Number(req.query.limit) || FEED_LIMIT, MAX_FEED_LIMIT);
    pruneOldViews(); // opportunistic housekeeping, not awaited

    const feed = await cached(`feed:${strict ? "s" : "w"}:${limit}:${geoKey(scope, req.visitorGeo)}`, () =>
      getRecentRoasts(req.visitorGeo, scope, { strict, limit })
    );

    return res.status(200).json({
      scope: feed.scope,
      label: feed.label,
      roasts: feed.rows.map(toProfileRow),
    });
  } catch (error) {
    logger.error("Error reading recent roasts", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// How many of each card tier have ever been pulled. This is what lets the card
// claim real scarcity ("95 of these exist") instead of only quoting its design
// probability — the observed number is the part worth screenshotting.
engagementRouter.get("/cards/counts", async (_req, res) => {
  try {
    const counts = await cached("cards:counts", () => getCardTierCounts());
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return res.status(200).json({ counts, total });
  } catch (error) {
    logger.error("Error reading card tier counts", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

engagementRouter.get("/leaderboard", async (req, res) => {
  try {
    const scope = parseScope(req.query.scope);
    const range = parseRange(req.query.range);

    const board = await cached(`board:${range}:${geoKey(scope, req.visitorGeo)}`, () =>
      getLeaderboard(req.visitorGeo, scope, range)
    );

    return res.status(200).json({
      range,
      mostRoasted: {
        scope: board.mostRoasted.scope,
        label: board.mostRoasted.label,
        entries: board.mostRoasted.rows.map(toProfileRow),
      },
      topRated: {
        scope: board.topRated.scope,
        label: board.topRated.label,
        entries: board.topRated.rows.map(toProfileRow),
      },
    });
  } catch (error) {
    logger.error("Error reading leaderboard", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Lets the frontend label its "near you" tab before any data comes back, and
// hide the tab entirely for visitors we couldn't place.
engagementRouter.get("/visitorScope", (req, res) => {
  const { country = null, region = null, city = null } = req.visitorGeo || {};
  return res.status(200).json({ country, region, city });
});

module.exports = engagementRouter;
