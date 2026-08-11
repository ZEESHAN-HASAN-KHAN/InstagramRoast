const { pool } = require("./db");
const logger = require("../helpers/logger");

// Which roast pages are worth putting in front of Google.
//
// The gate is deliberately strict. Every handle anyone has ever typed into the
// box has a page, and most of them belong to private individuals with a handful
// of followers. Submitting all of them would (a) put a stranger's name next to
// an insult generator in search results and (b) bury the domain under thousands
// of near-identical AI-generated pages, which is exactly the thin-content
// pattern Google discounts a whole site for.
//
// A follower floor solves both at once: it keeps the sitemap to accounts that
// are already public figures, and those are the pages people actually search
// for. Pages below the floor stay live and shareable — they just carry
// `noindex` instead (see `indexable` on the og-meta payload).
const MIN_FOLLOWERS = Number(process.env.SITEMAP_MIN_FOLLOWERS) || 5000;

// Handles pulled after a takedown request. Comma-separated env var so a removal
// takes a restart rather than a migration; move it to a table if the list grows.
const BLOCKLIST = (process.env.SITEMAP_BLOCKLIST || "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/**
 * Whether a single profile row qualifies, using the same rule as the SQL below.
 *
 * Exists so the page and the sitemap can never disagree: the frontend asks this
 * (via og-meta) to decide the robots tag, and a page marked `index` that isn't
 * in the sitemap — or the reverse — is the kind of mismatch that quietly costs
 * you crawl budget.
 */
function isIndexable(profile) {
  if (!profile || !profile.username) return false;
  if (BLOCKLIST.includes(profile.username.toLowerCase())) return false;
  return Number(profile.follower) >= MIN_FOLLOWERS;
}

// One row per profile that has at least one non-empty roast.
//
// Ordered by `p.id`, not by recency: shards are fetched as separate HTTP
// requests, and any ordering that shifts when a new roast lands would drop or
// duplicate URLs across shard boundaries mid-crawl. `id` is append-only, so a
// new profile only ever extends the last shard.
const ELIGIBLE = `
  FROM profiles p
  JOIN ai_responses r ON r.profile_id = p.id
  WHERE p.follower >= $1
    AND r.response_text IS NOT NULL
    AND r.response_text <> ''
    AND NOT (lower(p.username) = ANY($2::text[]))
`;

/** How many roast URLs qualify right now. */
async function countIndexableProfiles() {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT p.id)::int AS n ${ELIGIBLE};`,
    [MIN_FOLLOWERS, BLOCKLIST]
  );
  return rows[0]?.n ?? 0;
}

/**
 * One page of qualifying profiles.
 *
 * `lastmod` is the newest roast for that profile, so a re-roast moves the date
 * and Google recrawls the page instead of trusting its cached copy.
 *
 * @returns {Promise<Array<{username: string, lastmod: Date, follower: number}>>}
 */
async function getIndexableProfiles(limit, offset) {
  const { rows } = await pool.query(
    `SELECT p.username,
            p.follower,
            MAX(r.created_at) AS lastmod
       ${ELIGIBLE}
      GROUP BY p.id, p.username, p.follower
      ORDER BY p.id
      LIMIT $3 OFFSET $4;`,
    [MIN_FOLLOWERS, BLOCKLIST, limit, offset]
  );
  return rows;
}

/** Newest roast across the whole eligible set — the index file's own lastmod. */
async function getNewestRoastAt() {
  try {
    const { rows } = await pool.query(
      `SELECT MAX(r.created_at) AS lastmod ${ELIGIBLE};`,
      [MIN_FOLLOWERS, BLOCKLIST]
    );
    return rows[0]?.lastmod ?? null;
  } catch (error) {
    logger.error("[sitemap] newest roast lookup failed", { error: error.message });
    return null;
  }
}

module.exports = {
  MIN_FOLLOWERS,
  BLOCKLIST,
  isIndexable,
  countIndexableProfiles,
  getIndexableProfiles,
  getNewestRoastAt,
};
