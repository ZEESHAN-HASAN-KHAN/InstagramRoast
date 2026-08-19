const { pool } = require("./db");
const logger = require("../helpers/logger");

// How long opening checkout holds a mint against other claimants. Long enough
// to finish a UPI or PayPal flow on a slow phone, short enough that abandoning
// checkout doesn't strand the number for the next visitor.
const RESERVATION_MINUTES = Number(process.env.MINT_RESERVATION_MINUTES) || 15;

/**
 * Assigns the next mint number for a profile.
 *
 * Runs in its own transaction with the profile row locked, and that shape is
 * load-bearing rather than decorative. Doing it as one statement with a
 * `FOR UPDATE` CTE looks equivalent but is not: under READ COMMITTED every CTE
 * in a statement reads the snapshot taken when the statement began, so a waiter
 * that blocks on the lock still computes MAX(mint_no) from before the winner's
 * insert and hands out a duplicate number. Inside a transaction each statement
 * takes a fresh snapshot, so the INSERT below genuinely sees the row the
 * previous holder just committed.
 *
 * Idempotent via the UNIQUE on ai_response_id — a roast that already has a mint
 * keeps the one it has, so this is safe to call from both the insert path and
 * the lazy heal path.
 */
async function assignMint({ profileId, aiResponseId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM profiles WHERE id = $1 FOR UPDATE;`, [profileId]);
    const result = await client.query(
      `INSERT INTO card_mints (profile_id, ai_response_id, mint_no)
       SELECT $1, $2, COALESCE(MAX(mint_no), 0) + 1 FROM card_mints WHERE profile_id = $1
       ON CONFLICT (ai_response_id) DO NOTHING
       RETURNING *;`,
      [profileId, aiResponseId]
    );
    // No row means this roast was already minted — read back the existing one
    // rather than reporting nothing, so callers get the same shape either way.
    const row =
      result.rows[0] ||
      (
        await client.query(`SELECT * FROM card_mints WHERE ai_response_id = $1;`, [aiResponseId])
      ).rows[0] ||
      null;
    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error("Error assigning card mint", { error: error.message, aiResponseId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Everything the card face and the claim panel need about one roast's mint.
 *
 * `total` is the profile's mint count, which is what makes "#3 / 47" mean
 * something. `claimedBy` being null is the sellable state.
 */
async function getMintSummary(aiResponseId) {
  const result = await pool.query(
    `SELECT cm.id,
            cm.profile_id,
            cm.mint_no,
            cm.claimed_by,
            cm.claimed_at,
            (SELECT COUNT(*)::int FROM card_mints t WHERE t.profile_id = cm.profile_id) AS total,
            (cm.claim_reserved_until IS NOT NULL AND cm.claim_reserved_until > now()) AS reserved,
            cm.claim_reserved_by
     FROM card_mints cm
     WHERE cm.ai_response_id = $1;`,
    [aiResponseId]
  );
  return result.rows[0] || null;
}

/**
 * Takes the short exclusive hold that lets one visitor open checkout on a mint.
 *
 * Refuses when the mint is already claimed, or when someone else holds a live
 * reservation. Re-reserving your own live hold succeeds and extends it, so
 * reopening a checkout you abandoned a minute ago is not a dead end.
 *
 * Single atomic UPDATE: two simultaneous claimants can't both read "free" and
 * both proceed, because the second one's WHERE no longer matches.
 */
async function reserveMint({ mintId, sessionId }) {
  const result = await pool.query(
    `UPDATE card_mints
     SET claim_reserved_until = now() + ($3 || ' minutes')::interval,
         claim_reserved_by    = $2
     WHERE id = $1
       AND claimed_by IS NULL
       AND (claim_reserved_until IS NULL
            OR claim_reserved_until < now()
            OR claim_reserved_by = $2)
     RETURNING *;`,
    [mintId, sessionId, String(RESERVATION_MINUTES)]
  );
  return result.rows[0] || null;
}

/**
 * Reads one mint by its own id, with the profile's username along for the ride
 * so a confirmation can name the handle without a second query.
 *
 * Used after fulfilment to report the finished claim: the fulfilment statement
 * is idempotent and returns nothing on a replay, so the confirmation reads the
 * settled state here rather than depending on having been the call that wrote it.
 */
async function getMintById(mintId) {
  const result = await pool.query(
    `SELECT cm.*, p.username
     FROM card_mints cm
     JOIN profiles p ON p.id = cm.profile_id
     WHERE cm.id = $1;`,
    [mintId]
  );
  return result.rows[0] || null;
}

/** The claimed-mint registry for one profile — what the card page credits. */
async function getClaimedMints(profileId) {
  const result = await pool.query(
    `SELECT cm.mint_no, cm.claimed_by, cm.claimed_at, cm.ai_response_id, a.card_tier
     FROM card_mints cm
     JOIN ai_responses a ON a.id = cm.ai_response_id
     WHERE cm.profile_id = $1 AND cm.claimed_by IS NOT NULL
     ORDER BY cm.mint_no;`,
    [profileId]
  );
  return result.rows;
}

module.exports = {
  RESERVATION_MINUTES,
  assignMint,
  getMintById,
  getMintSummary,
  reserveMint,
  getClaimedMints,
};
