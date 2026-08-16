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
// anything. Two is the lowest honest floor: with only one rated profile there's
// nothing to rank against and everyone would read "top 1%".
const MIN_RANKED_PROFILES = 2;
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

// --- unlocked card tier ------------------------------------------------------

// The tier a profile wears in every list on the site, or NULL when nobody has
// flipped its card yet. Face-down cards must not leak their tier: the whole
// point of the pull is that the rarity is unknown until someone opens it, so
// the EXISTS on card_reveals is a correctness condition, not an optimisation.
//
// Most recent revealed card wins. A re-roast mints a new card that starts face
// down, so a profile keeps showing its last opened card until the new one is
// pulled — which is the honest answer to "what has this profile got".
//
// LATERAL rather than a correlated scalar subquery per column: it stays one
// join for however many fields this eventually needs, and every caller already
// has `p` in scope.
const REVEALED_CARD_JOIN = `
  LEFT JOIN LATERAL (
    SELECT a.card_tier
    FROM ai_responses a
    WHERE a.profile_id = p.id
      AND a.card_tier IS NOT NULL
      AND EXISTS (SELECT 1 FROM card_reveals cr WHERE cr.ai_response_id = a.id)
    ORDER BY a.created_at DESC
    LIMIT 1
  ) card ON TRUE`;

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
              p.username, p.full_name, p.profile_pic_url, a.created_at, card.card_tier
       FROM ai_responses a
       JOIN profiles p ON p.id = a.profile_id
       ${REVEALED_CARD_JOIN}
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

// Two boards, two time ranges. "day" is the rolling window — what's hot right
// now, and the reason to come back tomorrow. "all" is the permanent record,
// which is the one worth linking to.
const RANGES = ["day", "all"];
const parseRange = (value) => (RANGES.includes(value) ? value : "day");

// Most-viewed roasts in the rolling window. Views, not generated roasts: a roast
// is generated once and then read by everyone who opens the link, so counting
// generations would score every profile 1.
//
// DISTINCT viewers, so the number means "how many people saw this" — one person
// coming back across several hours is one entry on the board, not several.
async function queryMostRoastedDay(params) {
  const result = await pool.query(
    `SELECT p.username, p.full_name, p.profile_pic_url, card.card_tier,
            COUNT(DISTINCT v.viewer_key)::int AS roast_count
     FROM profile_views v
     JOIN profiles p ON p.id = v.profile_id
     ${REVEALED_CARD_JOIN}
     WHERE v.created_at > now() - ($4::text || ' hours')::interval
       AND ($1::text IS NULL OR v.viewer_country = $1)
       AND ($2::text IS NULL OR v.viewer_region  = $2)
       AND ($3::text IS NULL OR v.viewer_city    = $3)
     -- card_tier joins the key because the planner only infers functional
     -- dependency from p's own primary key, not through a lateral.
     GROUP BY p.id, card.card_tier
     ORDER BY roast_count DESC, MAX(v.created_at) DESC
     LIMIT ${BOARD_LIMIT};`,
    [params.country, params.region, params.city, String(BOARD_WINDOW_HOURS)]
  );
  return result.rows;
}

// Same number over all of history. It reads from profile_view_totals rather
// than profile_views because the latter is pruned weekly — and the totals table
// already holds one row per distinct viewer, so this is a plain COUNT(*).
async function queryMostRoastedAllTime(params) {
  const result = await pool.query(
    `SELECT p.username, p.full_name, p.profile_pic_url, card.card_tier,
            COUNT(*)::int AS roast_count
     FROM profile_view_totals t
     JOIN profiles p ON p.id = t.profile_id
     ${REVEALED_CARD_JOIN}
     WHERE ($1::text IS NULL OR t.viewer_country = $1)
       AND ($2::text IS NULL OR t.viewer_region  = $2)
       AND ($3::text IS NULL OR t.viewer_city    = $3)
     GROUP BY p.id, card.card_tier
     ORDER BY roast_count DESC, MAX(t.first_viewed_at) DESC
     LIMIT ${BOARD_LIMIT};`,
    [params.country, params.region, params.city]
  );
  return result.rows;
}

// Highest-rated profiles, scoped by where the *voters* were — a local board
// should reflect what your area found savage, not who happened to generate it.
//
// `windowHours` null means all of history. On the day board it filters on when
// the vote was cast, so the two boards on that tab describe the same 24 hours;
// without it the savage board silently showed lifetime ratings next to a
// window'd view count and the tab's "today" label was only true of one half.
async function queryTopRated(params, windowHours) {
  const result = await pool.query(
    `SELECT p.username, p.full_name, p.profile_pic_url, card.card_tier,
            AVG(r.rating)::float8 AS average, COUNT(*)::int AS votes
     FROM roast_ratings r
     JOIN profiles p ON p.id = r.profile_id
     ${REVEALED_CARD_JOIN}
     WHERE ($1::text IS NULL OR r.voter_country = $1)
       AND ($2::text IS NULL OR r.voter_region  = $2)
       AND ($3::text IS NULL OR r.voter_city    = $3)
       AND ($4::text IS NULL OR r.created_at > now() - ($4::text || ' hours')::interval)
     GROUP BY p.id, card.card_tier
     HAVING COUNT(*) >= ${MIN_VOTES_FOR_BOARD}
     ORDER BY average DESC, votes DESC
     LIMIT ${BOARD_LIMIT};`,
    [params.country, params.region, params.city, windowHours === null ? null : String(windowHours)]
  );
  return result.rows;
}

// Both boards resolve their scope independently: ratings are far sparser than
// views, so forcing them to share one scope would either drag the busy board up
// to global or leave the quiet one empty.
async function getLeaderboard(geo, scope = "global", range = "day") {
  const allTime = parseRange(range) === "all";
  const [mostRoasted, topRated] = await Promise.all([
    withScopeCascade(geo, scope, 3, allTime ? queryMostRoastedAllTime : queryMostRoastedDay),
    withScopeCascade(geo, scope, 3, (params) =>
      queryTopRated(params, allTime ? null : BOARD_WINDOW_HOURS)
    ),
  ]);
  return { mostRoasted, topRated };
}

// --- card reveals ------------------------------------------------------------

/**
 * Has this card been flipped face-up by anyone yet?
 *
 * Deliberately global rather than per-viewer: a card is pulled once, and after
 * that it stays open for everybody who lands on that roast. Rows are still
 * written per viewer (see recordCardReveal) so we keep who opened it and when —
 * that history is what a per-viewer check would need if this is ever reverted.
 *
 * @param {number} aiResponseId the roast the card was minted from
 */
async function hasRevealedCard(aiResponseId) {
  if (!aiResponseId) return false;
  const result = await pool.query(
    `SELECT 1 FROM card_reveals WHERE ai_response_id = $1 LIMIT 1;`,
    [aiResponseId]
  );
  return result.rowCount > 0;
}

/**
 * Records that a viewer flipped a card.
 *
 * Idempotent by constraint: a second tap (double click, reload mid-animation,
 * a retry after a dropped response) collides on the unique pair and is a no-op,
 * so revealed_at keeps the moment of the *first* pull.
 */
async function recordCardReveal({ aiResponseId, profileId, sessionId, ip, viewerKey }) {
  const result = await pool.query(
    `INSERT INTO card_reveals (ai_response_id, profile_id, session_id, ip_address, viewer_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ai_response_id, viewer_key) DO NOTHING
     RETURNING id;`,
    [aiResponseId, profileId, sessionId ?? null, ip ?? null, viewerKey]
  );
  // rowCount 0 means it was already revealed, which is success, not failure.
  return { firstReveal: result.rowCount > 0 };
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
  const viewerKey = viewerKeyFor(viewer);
  pool
    .query(
      `INSERT INTO profile_views
         (profile_id, viewer_key, view_hour, viewer_country, viewer_region, viewer_city)
       VALUES ($1, $2, date_trunc('hour', now()), $3, $4, $5)
       ON CONFLICT (profile_id, viewer_key, view_hour) DO NOTHING;`,
      [profileId, viewerKey, country, region, city]
    )
    .catch((error) => logger.error("Failed to record profile view", { profileId, error: error.message }));

  // The permanent record, written on every view rather than only the first:
  // the ON CONFLICT makes repeats free, and the row must survive the prune that
  // eventually takes the profile_views row above. A failure here is logged and
  // healed by the backfill on next boot, not retried.
  pool
    .query(
      `INSERT INTO profile_view_totals
         (profile_id, viewer_key, viewer_country, viewer_region, viewer_city)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (profile_id, viewer_key) DO NOTHING;`,
      [profileId, viewerKey, country, region, city]
    )
    .catch((error) =>
      logger.error("Failed to record all-time profile view", { profileId, error: error.message })
    );
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
  hasRevealedCard,
  recordCardReveal,
  SCOPES,
  RANGES,
};
