const { pool } = require("./db");
const logger = require("../helpers/logger");

// Every scoped query below takes the same three nullable geo params and uses the
// `$n IS NULL OR column = $n` idiom, so one prepared statement covers all four
// scopes and no SQL is ever built from a string. `null` in a slot means "don't
// filter on this level", which is how the global scope is expressed.
const SCOPES = ["city", "region", "country", "global"];

// Turns a visitor's geo into the filter params for a given scope. Returns null
// when the visitor doesn't have the location that scope needs (no city on
// record, say), so the cascade can skip straight past it.
function scopeParams(scope, geo = {}) {
  const { country = null, region = null, city = null } = geo || {};
  switch (scope) {
    case "city":
      return country && city ? { country, region, city } : null;
    case "region":
      return country && region ? { country, region, city: null } : null;
    case "country":
      return country ? { country, region: null, city: null } : null;
    default:
      return { country: null, region: null, city: null };
  }
}

// Human-readable name for whichever scope actually produced rows, so the UI can
// say "in Kolkata" honestly instead of promising local results it fell back out
// of.
function scopeLabel(scope, geo = {}) {
  const { country = null, region = null, city = null } = geo || {};
  if (scope === "city") return city;
  if (scope === "region") return region;
  if (scope === "country") return country;
  return "Global";
}

// Runs `queryFn` at the narrowest scope the visitor qualifies for and widens
// until it comes back with enough rows to be worth showing. A two-name "people
// near you" list looks broken; falling back to the country's list does not.
async function withScopeCascade(geo, requestedScope, minRows, queryFn) {
  const startAt = SCOPES.indexOf(requestedScope);
  const candidates = startAt === -1 ? ["global"] : SCOPES.slice(startAt);

  let widest = { rows: [], scope: "global" };
  for (const scope of candidates) {
    const params = scopeParams(scope, geo);
    if (!params) continue;

    const rows = await queryFn(params);
    widest = { rows, scope };
    if (rows.length >= minRows) break;
  }

  return { ...widest, label: scopeLabel(widest.scope, geo) };
}

// --- ratings -----------------------------------------------------------------

// A profile needs this many rated peers in a scope before a percentile means
// anything — "top 50% of 2 profiles" is noise dressed up as a statistic.
const MIN_RANKED_PROFILES = 3;
// And a profile needs this many votes of its own before it can appear on the
// most-savage board.
const MIN_VOTES_FOR_BOARD = 2;

// One vote per person per profile, updatable. `voterKey` is the session id, or
// 'ip:<addr>' for visitors in regions where sessions are switched off.
async function upsertRating({ profileId, aiResponseId, sessionId, ip, voterKey, rating, geo }) {
  const { country = null, region = null, city = null } = geo || {};
  const result = await pool.query(
    `INSERT INTO roast_ratings
       (profile_id, ai_response_id, session_id, ip_address, voter_key, rating, voter_country, voter_region, voter_city)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (profile_id, voter_key) DO UPDATE
       SET rating = EXCLUDED.rating,
           ai_response_id = EXCLUDED.ai_response_id,
           updated_at = now()
     RETURNING *;`,
    [profileId, aiResponseId, sessionId, ip, voterKey, rating, country, region, city]
  );
  return result.rows[0];
}

// The roast a vote is attached to. Ratings are per profile rather than per
// roast (you're rating how burnt someone got, and a re-roast shouldn't reset
// their score), but recording which version was on screen is worth having.
async function getLatestResponseId(profileId) {
  const result = await pool.query(
    `SELECT id FROM ai_responses WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1;`,
    [profileId]
  );
  return result.rows[0]?.id ?? null;
}

// Where this profile's average sits among every rated profile in a scope,
// expressed as "top N%". Null when the scope hasn't enough rated profiles to
// rank against, or when this profile has no votes yet.
async function getPercentile(profileId, params) {
  const result = await pool.query(
    `WITH scoped_profiles AS (
       SELECT DISTINCT profile_id
       FROM ai_responses
       WHERE ($2::text IS NULL OR roaster_country = $2)
         AND ($3::text IS NULL OR roaster_region  = $3)
         AND ($4::text IS NULL OR roaster_city    = $4)
     ),
     profile_avgs AS (
       SELECT r.profile_id, AVG(r.rating)::float8 AS avg_rating
       FROM roast_ratings r
       JOIN scoped_profiles sp ON sp.profile_id = r.profile_id
       GROUP BY r.profile_id
     ),
     ranked AS (
       SELECT profile_id,
              PERCENT_RANK() OVER (ORDER BY avg_rating) AS pr,
              COUNT(*) OVER () AS total
       FROM profile_avgs
     )
     SELECT pr, total FROM ranked WHERE profile_id = $1;`,
    [profileId, params.country, params.region, params.city]
  );

  const row = result.rows[0];
  if (!row || Number(row.total) < MIN_RANKED_PROFILES) return null;
  // PERCENT_RANK is 0 for the worst-rated profile, so invert it: higher rating
  // means a smaller (better) "top N%". Clamped to 1 so the single most savage
  // profile reads "top 1%" rather than "top 0%".
  const topPercent = Math.max(1, Math.round((1 - Number(row.pr)) * 100));
  return { topPercent, outOf: Number(row.total) };
}

// Average, vote count, this visitor's own vote, and where the profile ranks —
// both globally and in the tightest local scope the visitor qualifies for.
async function getRatingStats(profileId, voterKey, geo) {
  const totals = await pool.query(
    `SELECT AVG(rating)::float8 AS avg, COUNT(*)::int AS count,
            MAX(CASE WHEN voter_key = $2 THEN rating END)::int AS your_rating
     FROM roast_ratings
     WHERE profile_id = $1;`,
    [profileId, voterKey]
  );
  const { avg, count, your_rating: yourRating } = totals.rows[0];

  const stats = {
    average: avg === null ? null : Number(avg),
    count: Number(count),
    yourRating: yourRating ?? null,
    global: null,
    local: null,
    localLabel: null,
  };

  if (stats.count === 0) return stats;

  stats.global = await getPercentile(profileId, scopeParams("global", geo));

  // The tightest scope that can actually rank this profile — a visitor with no
  // city on record just doesn't get a local standing.
  for (const scope of ["city", "region", "country"]) {
    const params = scopeParams(scope, geo);
    if (!params) continue;
    const percentile = await getPercentile(profileId, params);
    if (percentile) {
      stats.local = percentile;
      stats.localLabel = scopeLabel(scope, geo);
      break;
    }
  }

  return stats;
}

// --- discovery feed ----------------------------------------------------------

const FEED_LIMIT = 15;
// Below this a "roasted near you" strip is more embarrassing than social proof,
// so the cascade widens instead.
const MIN_FEED_ROWS = 4;

// Most recently roasted profiles, newest first, one entry per profile so a
// re-roasted profile doesn't fill the strip with itself.
async function queryRecentRoasts(params, limit = FEED_LIMIT) {
  const result = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (a.profile_id)
              p.username, p.full_name, p.profile_pic_url, a.created_at
       FROM ai_responses a
       JOIN profiles p ON p.id = a.profile_id
       WHERE ($1::text IS NULL OR a.roaster_country = $1)
         AND ($2::text IS NULL OR a.roaster_region  = $2)
         AND ($3::text IS NULL OR a.roaster_city    = $3)
       ORDER BY a.profile_id, a.created_at DESC
     ) newest
     ORDER BY newest.created_at DESC
     LIMIT $4;`,
    [params.country, params.region, params.city, limit]
  );
  return result.rows;
}

// `strict` turns off the widening cascade. The ticker wants the cascade — it
// would rather show *something* than nothing. A tab the visitor deliberately
// picked wants the opposite: answering "my region" with global results while
// still calling it "my region" is a lie, so an empty region stays empty.
async function getRecentRoasts(geo, scope = "global", { strict = false, limit = FEED_LIMIT } = {}) {
  if (!strict) {
    return withScopeCascade(geo, scope, MIN_FEED_ROWS, (params) => queryRecentRoasts(params, limit));
  }

  const params = scopeParams(scope, geo);
  // The visitor doesn't have the location this scope needs — no rows, and the
  // caller shouldn't have offered the tab in the first place.
  if (!params) return { rows: [], scope, label: scopeLabel(scope, geo) };

  return { rows: await queryRecentRoasts(params, limit), scope, label: scopeLabel(scope, geo) };
}

// --- leaderboards ------------------------------------------------------------

const BOARD_LIMIT = 10;
const BOARD_WINDOW_HOURS = Number(process.env.LEADERBOARD_WINDOW_HOURS) || 24;

// Most-viewed roasts in the rolling window. Views, not generated roasts: a roast
// is generated once and then read by everyone who opens the link, so counting
// generations would score every profile 1.
//
// DISTINCT viewers, so the number means "how many people saw this" — one person
// coming back across several hours is one entry on the board, not several.
async function queryMostRoasted(params) {
  const result = await pool.query(
    `SELECT p.username, p.full_name, p.profile_pic_url,
            COUNT(DISTINCT v.viewer_key)::int AS roast_count
     FROM profile_views v
     JOIN profiles p ON p.id = v.profile_id
     WHERE v.created_at > now() - ($4::text || ' hours')::interval
       AND ($1::text IS NULL OR v.viewer_country = $1)
       AND ($2::text IS NULL OR v.viewer_region  = $2)
       AND ($3::text IS NULL OR v.viewer_city    = $3)
     GROUP BY p.id
     ORDER BY roast_count DESC, MAX(v.created_at) DESC
     LIMIT ${BOARD_LIMIT};`,
    [params.country, params.region, params.city, String(BOARD_WINDOW_HOURS)]
  );
  return result.rows;
}

// Highest-rated profiles, scoped by where the *voters* were — a local board
// should reflect what your area found savage, not who happened to generate it.
async function queryTopRated(params) {
  const result = await pool.query(
    `SELECT p.username, p.full_name, p.profile_pic_url,
            AVG(r.rating)::float8 AS average, COUNT(*)::int AS votes
     FROM roast_ratings r
     JOIN profiles p ON p.id = r.profile_id
     WHERE ($1::text IS NULL OR r.voter_country = $1)
       AND ($2::text IS NULL OR r.voter_region  = $2)
       AND ($3::text IS NULL OR r.voter_city    = $3)
     GROUP BY p.id
     HAVING COUNT(*) >= ${MIN_VOTES_FOR_BOARD}
     ORDER BY average DESC, votes DESC
     LIMIT ${BOARD_LIMIT};`,
    [params.country, params.region, params.city]
  );
  return result.rows;
}

// Both boards resolve their scope independently: ratings are far sparser than
// views, so forcing them to share one scope would either drag the busy board up
// to global or leave the quiet one empty.
async function getLeaderboard(geo, scope = "global") {
  const [mostRoasted, topRated] = await Promise.all([
    withScopeCascade(geo, scope, 3, queryMostRoasted),
    withScopeCascade(geo, scope, 3, queryTopRated),
  ]);
  return { mostRoasted, topRated };
}

// --- view tracking -----------------------------------------------------------

// Identifies a viewer/voter across the engagement features. Sessions only exist
// where monetization is switched on, so visitors elsewhere fall back to IP —
// imperfect (a shared NAT collapses into one person) but it's a fun leaderboard,
// not an election.
function viewerKeyFor({ sessionId, ip }) {
  return sessionId ?? `ip:${ip || "unknown"}`;
}

// Fire-and-forget: a failure here must never cost someone their roast, and the
// caller shouldn't wait on it either.
//
// At most one row per viewer per profile per hour. The roast page re-requests
// its roast on every load, so counting raw requests would let anyone top the
// board by holding refresh — the ON CONFLICT makes those extra loads free.
function recordProfileView(profileId, geo = {}, viewer = {}) {
  if (!profileId) return;
  const { country = null, region = null, city = null } = geo || {};
  pool
    .query(
      `INSERT INTO profile_views
         (profile_id, viewer_key, view_hour, viewer_country, viewer_region, viewer_city)
       VALUES ($1, $2, date_trunc('hour', now()), $3, $4, $5)
       ON CONFLICT (profile_id, viewer_key, view_hour) DO NOTHING;`,
      [profileId, viewerKeyFor(viewer), country, region, city]
    )
    .catch((error) => logger.error("Failed to record profile view", { profileId, error: error.message }));
}

const VIEW_RETENTION_DAYS = Number(process.env.PROFILE_VIEW_RETENTION_DAYS) || 7;

// Only the last BOARD_WINDOW_HOURS is ever read, so anything past the retention
// window is dead weight. Runs on the same opportunistic backstop as the stale-job
// sweeps rather than needing its own timer, and self-throttles to once an hour.
let lastPrune = 0;
function pruneOldViews() {
  const HOUR_MS = 60 * 60 * 1000;
  if (Date.now() - lastPrune < HOUR_MS) return;
  lastPrune = Date.now();
  pool
    .query(`DELETE FROM profile_views WHERE created_at < now() - ($1::text || ' days')::interval;`, [
      String(VIEW_RETENTION_DAYS),
    ])
    .catch((error) => logger.error("Failed to prune profile views", { error: error.message }));
}

module.exports = {
  upsertRating,
  getLatestResponseId,
  getRatingStats,
  getRecentRoasts,
  getLeaderboard,
  recordProfileView,
  pruneOldViews,
  viewerKeyFor,
  SCOPES,
};
