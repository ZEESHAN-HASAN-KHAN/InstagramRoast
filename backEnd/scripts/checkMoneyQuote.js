/**
 * Checks that the roast prompt actually produces a money quote — one savage,
 * standalone, screenshot-worthy line on line 1 — and that the card/unfurl
 * pipeline picks up exactly that line.
 *
 *   node scripts/checkMoneyQuote.js            # 10 single roasts
 *   node scripts/checkMoneyQuote.js --compat   # 5 compatibility roasts
 *
 * Hits the real LLM (it is the thing under test) but not the Instagram API —
 * profiles are fixtures, so this costs LLM tokens only. Exits non-zero if any
 * roast fails the shape rules, so it can gate a prompt change.
 */
require("dotenv").config();

const { generateAIRoast, generateAICompatiblityRoast } = require("../helpers/apiHelper");
const { extractBestLine, stripMarkdown, stripEmoji } = require("../helpers/cardIdentity");

// The band cardIdentity will actually print. The prompt asks for 40-130 to keep
// a margin — a line past that still ships, it just renders small, so it is
// reported separately from an outright failure.
const MIN_HEADLINE = 40;
const MAX_HEADLINE = 165;
const PROMPT_MAX = 130;

const PROFILES = [
  { full_name: "Dev Malhotra", username: "dev.builds", follower: 412, following: 2130, isPrivate: false, biography: "founder | 3x failed startups | building in public 🚀", post: 47 },
  { full_name: "Ritika S", username: "ritikaaaa_", follower: 18400, following: 312, isPrivate: false, biography: "content creator | collabs 📩 | soft life era", post: 892 },
  { full_name: "", username: "gym_rat_2003", follower: 203, following: 1890, isPrivate: false, biography: "no pain no gain 💪 natty", post: 12 },
  { full_name: "Arjun Mehta", username: "arjun.travels", follower: 3120, following: 2980, isPrivate: false, biography: "32 countries ✈️ | wanderer | living my truth", post: 1204 },
  { full_name: "Priya", username: "priya.reads", follower: 88, following: 640, isPrivate: true, biography: "books, chai, and overthinking", post: 3 },
  { full_name: "CryptoKing", username: "cryptoking.eth", follower: 9200, following: 11, isPrivate: false, biography: "financial freedom | DM for signals | NFA", post: 340 },
  { full_name: "Sam O'Neill", username: "samoneill", follower: 1, following: 0, isPrivate: false, biography: "", post: 0 },
  { full_name: "Neha Kapoor", username: "nehakapoorofficial", follower: 240000, following: 8, isPrivate: false, biography: "actor | model | brand collabs via team 💼", post: 2100 },
  { full_name: "foodie boi", username: "hungry.always.99", follower: 640, following: 4210, isPrivate: false, biography: "i eat therefore i am 🍔 reviews nobody asked for", post: 480 },
  { full_name: "Karan", username: "karan_", follower: 5100, following: 5090, isPrivate: false, biography: "engineer by day, engineer by night", post: 91 },
];

const PAIRS = [
  [PROFILES[0], PROFILES[1]],
  [PROFILES[2], PROFILES[4]],
  [PROFILES[3], PROFILES[8]],
  [PROFILES[5], PROFILES[7]],
  [PROFILES[6], PROFILES[9]],
];

const EMOJI = /\p{Extended_Pictographic}/u;
const META = /^\s*(here'?s|sure|okay|ok\b|roast|hot take|compatibility|verdict|tl;?dr)\b|^\s*\w[\w ]{0,20}:\s/i;
const WRAPPED = /^["“'‘].*["”'’]\s*$/;

function rawLines(text) {
  return String(text ?? "").split(/\r?\n/);
}

// Hard problems mean the card would ship something unusable. Notes are prompt
// non-compliance the extraction pipeline already cleans up — worth seeing when
// tuning the prompt, but not a reason to fail the gate.
function checkShape(roast) {
  const problems = [];
  const notes = [];
  const lines = rawLines(roast);
  const start = lines.findIndex((l) => l.trim());
  if (start === -1) return { problems: ["empty response"], notes, shipped: "" };

  const rawLead = lines[start].trim();
  const bodyLines = lines.slice(start + 1).filter((l) => l.trim());

  // What the card and the OG description will actually print.
  const shipped = extractBestLine(roast);

  if (!bodyLines.length) problems.push("no body under line 1 — the model returned one blob");
  if (shipped.length < MIN_HEADLINE) problems.push(`shipped line too short (${shipped.length} < ${MIN_HEADLINE})`);
  if (shipped.length > MAX_HEADLINE) problems.push(`shipped line too long (${shipped.length} > ${MAX_HEADLINE})`);
  if (EMOJI.test(shipped)) problems.push("emoji survived into the shipped line");
  if (WRAPPED.test(shipped)) problems.push("quotes survived into the shipped line");
  if (META.test(shipped)) problems.push("shipped line reads as a label or meta-commentary");

  const body = stripMarkdown(bodyLines.join(" "));
  if (body && shipped && body.includes(shipped)) problems.push("body repeats line 1 verbatim");

  // The point of the whole change: the line that ships must be the opener the
  // model wrote, not something the fallback heuristic dug out of the body.
  // Cleaning line 1 on its own means pairing it with a throwaway body, which is
  // what the extractor requires before it will trust a lead line.
  const expected = extractBestLine(`${rawLead}\n\nx`);
  if (bodyLines.length && shipped !== expected) {
    problems.push(`card would ship a different line: ${JSON.stringify(shipped)}`);
  }

  // Extraction keys off the line break, not the blank line, so a missing blank
  // line costs nothing — the intended quote still lands on the card.
  if (lines[start + 1] && lines[start + 1].trim()) notes.push("no blank line after line 1");
  if (EMOJI.test(rawLead)) notes.push("model put emoji on line 1 (stripped before printing)");
  // Anything the markdown stripper had to remove — bold, italics, a stray
  // heading marker. Cosmetic: it never reaches the card.
  if (stripMarkdown(rawLead) !== rawLead) {
    notes.push("model put markdown on line 1 (stripped before printing)");
  }
  if (shipped.length > PROMPT_MAX) notes.push(`line 1 over the ${PROMPT_MAX}-char prompt cap (${shipped.length}) — renders small`);

  return { problems, notes, shipped };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = { value: await fn(items[i]) };
        } catch (err) {
          out[i] = { error: err };
        }
      }
    })
  );
  return out;
}

async function main() {
  const compat = process.argv.includes("--compat");
  const language = process.env.MONEY_QUOTE_LANGUAGE || "English";
  const cases = compat ? PAIRS : PROFILES;
  const label = (c) => (compat ? `@${c[0].username} × @${c[1].username}` : `@${c.username}`);

  console.log(`Generating ${cases.length} ${compat ? "compatibility " : ""}roasts in ${language}...\n`);

  const results = await mapLimit(cases, 3, (c) =>
    compat
      ? generateAICompatiblityRoast(c[0], c[1], language)
      : generateAIRoast(c, null, language)
  );

  let passed = 0;
  results.forEach((result, i) => {
    const name = label(cases[i]);
    if (result.error) {
      console.log(`FAIL ${name}\n     generation threw: ${result.error.message}\n`);
      return;
    }
    const { problems, notes, shipped } = checkShape(result.value);
    if (!problems.length) passed++;
    console.log(`${problems.length ? "FAIL" : "PASS"} ${name}\n     ${shipped || "(nothing printable)"}`);
    for (const p of problems) console.log(`     ✗ ${p}`);
    for (const n of notes) console.log(`     · ${n}`);
    console.log("");
  });

  console.log(`${passed}/${cases.length} roasts produced a usable money quote.`);
  process.exit(passed === cases.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
