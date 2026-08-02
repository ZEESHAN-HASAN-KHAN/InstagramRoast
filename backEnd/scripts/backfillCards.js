/**
 * Fills card_tier / card_serial on ai_responses rows written before the card
 * columns existed.
 *
 *   node scripts/backfillCards.js --dry-run   # report only, no writes
 *   node scripts/backfillCards.js             # write
 *
 * Safe to re-run: it only touches rows where card_tier IS NULL, and the mint is
 * a pure function of (username, response_text), so a second pass over the same
 * row would compute the same answer anyway. Nothing here reads or writes any
 * column other than the two card ones.
 */
require("dotenv").config();

const { pool } = require("../database/db");
const { mintCard, RARITY_ORDER, RARITIES } = require("../helpers/cardIdentity");

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 500;

async function main() {
  const { rows: pending } = await pool.query(
    `SELECT ar.id, ar.response_text, p.username
       FROM ai_responses ar
       JOIN profiles p ON ar.profile_id = p.id
      WHERE ar.card_tier IS NULL
      ORDER BY ar.id;`
  );

  console.log(`${DRY_RUN ? "[dry run] " : ""}rows needing a card: ${pending.length}`);
  if (!pending.length) {
    await pool.end();
    return;
  }

  const tally = {};
  let written = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const ids = [];
    const tiers = [];
    const serials = [];

    for (const row of batch) {
      const { rarity, serial } = mintCard(row.username, row.response_text || "");
      tally[rarity.id] = (tally[rarity.id] || 0) + 1;
      ids.push(row.id);
      tiers.push(rarity.id);
      serials.push(serial);
    }

    if (!DRY_RUN) {
      // One statement per batch, matched up by array position.
      const result = await pool.query(
        `UPDATE ai_responses AS ar
            SET card_tier = v.tier, card_serial = v.serial
           FROM (SELECT UNNEST($1::int[]) AS id,
                        UNNEST($2::text[]) AS tier,
                        UNNEST($3::text[]) AS serial) AS v
          WHERE ar.id = v.id;`,
        [ids, tiers, serials]
      );
      written += result.rowCount;
    }
    process.stdout.write(`\r  ${Math.min(i + BATCH, pending.length)}/${pending.length}`);
  }

  console.log(`\n${DRY_RUN ? "would write" : "wrote"} ${DRY_RUN ? pending.length : written} rows\n`);
  for (const id of RARITY_ORDER) {
    const n = tally[id] || 0;
    const pct = ((n / pending.length) * 100).toFixed(2);
    console.log(
      `  ${RARITIES[id].name.padEnd(14)} ${String(n).padStart(5)}  ${pct.padStart(6)}%  (design ${RARITIES[id].pullRate}%)`
    );
  }

  if (!DRY_RUN) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS remaining FROM ai_responses WHERE card_tier IS NULL;`
    );
    console.log(`\nrows still without a card: ${rows[0].remaining}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("backfill failed:", err.message);
  process.exit(1);
});
