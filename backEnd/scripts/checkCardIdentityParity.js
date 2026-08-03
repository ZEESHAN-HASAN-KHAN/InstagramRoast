/**
 * Asserts backEnd/helpers/cardIdentity.js and frontEnd/src/lib/cardRarity.ts
 * mint identical cards.
 *
 * The two exist separately because they ship in different containers, so
 * nothing but this check stops them drifting. Drift is not cosmetic: the link
 * preview is rendered from the backend copy and the page the visitor lands on
 * is rendered from the frontend copy, so a divergence means the unfurl promises
 * a rarity the page then contradicts.
 *
 *   node scripts/checkCardIdentityParity.js
 *
 * Requires the frontend's dependencies to be installed (it borrows esbuild to
 * load the TypeScript). Skips with a clear message if they are not.
 */
const path = require("path");
const fs = require("fs");
const os = require("os");

const FRONTEND = path.resolve(__dirname, "../../frontEnd");
const SOURCE = path.join(FRONTEND, "src/lib/cardRarity.ts");

function loadFrontendImpl() {
  let esbuild;
  try {
    esbuild = require(path.join(FRONTEND, "node_modules/esbuild"));
  } catch {
    return null;
  }
  const out = path.join(os.tmpdir(), `cardRarity.parity.${process.pid}.cjs`);
  esbuild.buildSync({
    entryPoints: [SOURCE],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: out,
    logLevel: "error",
  });
  const mod = require(out);
  fs.unlinkSync(out);
  return mod;
}

const backend = require("../helpers/cardIdentity");
const frontend = loadFrontendImpl();

if (!frontend) {
  console.log("SKIP: frontEnd/node_modules not installed — run `npm install` in frontEnd/");
  process.exit(0);
}

// Deliberately awkward inputs: markdown, headings, emoji, no punctuation,
// non-Latin script, and lengths on both sides of every headline band edge.
const ROASTS = [
  "**Oh honey.** Your bio says _entrepreneur_ but your posts say unemployed with good lighting. 🔥",
  "# Roast\n\nYou are a walking LinkedIn post that nobody asked for and everybody scrolled past, which is the most consistent thing about you.",
  "Short.",
  "no punctuation at all just a long run of words that keeps going and going without ever stopping to let anyone breathe which is very much like your feed honestly and it goes on",
  "🔥🔥🔥",
  "आपकी प्रोफ़ाइल देखकर लगता है कि आपने कैमरा तो खरीदा लेकिन व्यक्तित्व किराए पर भी नहीं लिया।",
  "Wow. Nice. Cool. Your entire personality is a reposted gym mirror selfie with a quote about grinding.",
  "",
  // The money-quote shape the roast prompt now asks for, plus every way a model
  // gets it wrong: lead too short to print, lead too long to fit, lead wrapped
  // in markdown, lead with no body under it, and a heading glued on top.
  "Your bio is a personality test you failed twice and still framed.\n\nThree hundred followers, four hundred following, and a caption budget that ran out in 2019. 🔥",
  "Nope.\n\nEverything about this profile is a cry for help that even the algorithm ignored, and it shows in every single post.",
  "You have somehow turned having a camera into a personality, a career plan, and a very public apology to everyone who follows you for reasons nobody has ever managed to explain out loud.\n\nAnd the bio is worse.",
  "**Your entire feed is one long apology to a personality you never developed.**\n\n_Genuinely_ impressive commitment to the bit. 🥴",
  "Your bio is a personality test you failed twice and still framed.",
  "## Roast\n\nYour bio is a personality test you failed twice and still framed.\n\nThree hundred followers and not one of them would help you move.",
  "Your bio is a personality test you failed twice and still framed.\r\n\r\nThree hundred followers and not one of them would help you move.",
  "\"Your bio is a personality test you failed twice and still framed.\"\n\nThree hundred followers and not one would help you move.",
  "“Your bio says ‘entrepreneur’ but your feed says otherwise entirely.”\n\nAnd the follower count agrees with the feed.",
  "Line one with emoji 🔥 and a 👨🏽‍💻 family sequence to strip out cleanly.\n\nBody under it. 📉",
];
const HANDLES = ["cristiano", "arghya721", "a", "user.name_123", "日本語ユーザー"];

let checked = 0;
const failures = [];

for (const handle of HANDLES) {
  for (const roast of ROASTS) {
    const a = backend.mintCard(handle, roast);
    const b = frontend.mintCard(handle, roast);
    checked++;
    if (
      a.rarity.id !== b.rarity.id ||
      a.serial !== b.serial ||
      a.headline !== b.headline
    ) {
      failures.push({ handle, roast: roast.slice(0, 40), backend: a, frontend: b });
    }
  }
}

// Also sweep a wide synthetic range so a subtle hash difference (sign, overflow,
// rounding at a tier boundary) cannot hide in a handful of hand-picked cases.
// Every third vector uses the lead-line shape so the sweep exercises both
// extraction paths, with lengths that straddle the headline band on each.
for (let i = 0; i < 20000; i++) {
  const handle = `user_${i}`;
  const filler = "word ".repeat(i % 40);
  const roast =
    i % 3 === 0
      ? `Lead line ${i} ${filler}ends here.\n\nBody sentence ${i * 31} carries the rest of it.`
      : `roast ${i} with trailing words ${i * 31} and a sentence that ends here.`;
  const a = backend.mintCard(handle, roast);
  const b = frontend.mintCard(handle, roast);
  checked++;
  if (a.rarity.id !== b.rarity.id || a.serial !== b.serial || a.headline !== b.headline) {
    failures.push({ handle, backend: a, frontend: b });
    if (failures.length > 5) break;
  }
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} mismatch(es) out of ${checked} vectors`);
  console.error(JSON.stringify(failures.slice(0, 5), null, 2));
  process.exit(1);
}

console.log(`OK: backend and frontend agree on all ${checked} vectors`);
