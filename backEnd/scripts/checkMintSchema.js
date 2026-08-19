require("dotenv").config();

// Verifies the First Mint schema actually landed, and that the numbering it
// produced is sane.
//
// Worth having because dbConnect() runs every migration inside one try/catch
// that logs and continues: a statement that fails takes every later statement
// with it and the app still boots, serving a feature whose tables aren't there.
// Nothing surfaces that except looking.
//
//   node backEnd/scripts/checkMintSchema.js
//
// Read-only. Exits non-zero on the first problem found.

const { pool } = require("../database/db");

const problems = [];
const notes = [];

async function one(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

async function checkColumns(table, expected) {
  const { rows } = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1;`,
    [table]
  );
  if (rows.length === 0) {
    problems.push(`table "${table}" does not exist — the migration did not run`);
    return;
  }
  const present = new Set(rows.map((r) => r.column_name));
  for (const column of expected) {
    if (!present.has(column)) problems.push(`${table}.${column} is missing`);
  }
}

async function checkConstraint(name, table) {
  const row = await one(
    `SELECT 1 AS ok FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = $1 AND c.conname = $2;`,
    [table, name]
  );
  if (!row) problems.push(`constraint ${name} on ${table} is missing`);
}

(async () => {
  try {
    await checkColumns("card_mints", [
      "id",
      "profile_id",
      "ai_response_id",
      "mint_no",
      "claimed_by",
      "claimed_at",
      "claim_session",
      "claim_reserved_until",
      "claim_reserved_by",
    ]);
    await checkColumns("payment_orders", ["purpose", "mint_id", "claim_handle"]);

    // The two constraints the whole design leans on: one mint per roast, and no
    // two cards of a profile sharing a number.
    await checkConstraint("card_mints_ai_response_id_key", "card_mints");
    await checkConstraint("card_mints_profile_id_mint_no_key", "card_mints");

    if (problems.length === 0) {
      // Every roast should have a mint. A gap means the backfill was skipped or
      // an insert lost its mint write; the read path heals those on next view,
      // so a small number is informational rather than broken.
      const gap = await one(
        `SELECT COUNT(*)::int AS n FROM ai_responses a
         WHERE NOT EXISTS (SELECT 1 FROM card_mints m WHERE m.ai_response_id = a.id);`
      );
      notes.push(`roasts with no mint row: ${gap.n}${gap.n ? " (these heal on next card view)" : ""}`);

      // Numbering should be a dense 1..n per profile. A hole means rows were
      // deleted; a duplicate would mean the assignment lock failed, which is the
      // serious one.
      const dupes = await one(
        `SELECT COUNT(*)::int AS n FROM (
           SELECT profile_id, mint_no FROM card_mints
           GROUP BY profile_id, mint_no HAVING COUNT(*) > 1
         ) d;`
      );
      if (dupes.n > 0) problems.push(`${dupes.n} duplicate (profile_id, mint_no) pairs`);

      const totals = await one(
        `SELECT COUNT(*)::int AS mints,
                COUNT(*) FILTER (WHERE claimed_by IS NOT NULL)::int AS claimed,
                COUNT(*) FILTER (WHERE mint_no = 1 AND claimed_by IS NOT NULL)::int AS first_mints
         FROM card_mints;`
      );
      notes.push(
        `mints: ${totals.mints} · claimed: ${totals.claimed} · first-mint claims: ${totals.first_mints}`
      );

      // The back catalogue that is actually on sale. A #1 is only reachable —
      // and therefore only sellable — once its card has been flipped by
      // someone, because the archive route refuses face-down cards.
      const stock = await one(
        `SELECT COUNT(*)::int AS unclaimed_firsts,
                COUNT(*) FILTER (
                  WHERE EXISTS (SELECT 1 FROM card_reveals cr WHERE cr.ai_response_id = m.ai_response_id)
                )::int AS reachable
         FROM card_mints m
         WHERE m.mint_no = 1 AND m.claimed_by IS NULL;`
      );
      notes.push(
        `unclaimed #1s: ${stock.unclaimed_firsts} (${stock.reachable} reachable — the rest have never been flipped)`
      );
    }

    for (const note of notes) console.log("   " + note);

    if (problems.length) {
      console.error("\nFAIL");
      for (const p of problems) console.error("  ✗ " + p);
      process.exitCode = 1;
    } else {
      console.log("\nOK: mint schema is in place");
    }
  } catch (error) {
    console.error("FAIL: " + error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
