// Server-side twin of frontEnd/src/lib/cardRarity.ts.
//
// This is deliberately duplicated rather than shared: the two run in different
// deployment units (the frontend container never copies backEnd/), so there is
// no import path that survives both Docker builds. The duplication is only safe
// because it is pinned by a test — scripts/checkCardIdentityParity.js asserts
// both implementations agree on a fixed set of vectors. Change one, run that.
//
// It has to agree exactly: the link preview announces a rarity, and the page
// the visitor lands on recomputes it in the browser. A mismatch means the
// unfurl advertises a Golden Roast and the page shows a Mid Roast.

const RARITIES = {
  common: { id: "common", name: "Mid Roast", emoji: "🥴", pullRate: 55 },
  crispy: { id: "crispy", name: "Extra Crispy", emoji: "🔥", pullRate: 28 },
  nuclear: { id: "nuclear", name: "Nuclear Burn", emoji: "🌶️", pullRate: 12 },
  golden: { id: "golden", name: "Golden Roast", emoji: "👑", pullRate: 4.5 },
  diamond: { id: "diamond", name: "Diamond Burn", emoji: "💎", pullRate: 0.5 },
};

const RARITY_ORDER = ["common", "crispy", "nuclear", "golden", "diamond"];

function fnv1a(input, seed = 0x811c9dc5) {
  let hash = seed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/(\*\*\*|___)(.*?)\1/g, "$2")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function dropHeadingLines(md) {
  const kept = md.split(/\r?\n/).filter((line) => !/^\s{0,3}#{1,6}\s+/.test(line));
  return kept.join("\n").trim() ? kept.join("\n") : md;
}

const MIN_HEADLINE = 40;
const MAX_HEADLINE = 165;

function extractBestLine(roast) {
  const text = stripMarkdown(dropHeadingLines(roast));
  if (!text) return "";

  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const inBand = sentences.filter(
    (s) => s.length >= MIN_HEADLINE && s.length <= MAX_HEADLINE
  );
  if (inBand.length) {
    return inBand.reduce((best, s) => (s.length > best.length ? s : best));
  }

  const first = sentences[0] ?? text;
  if (first.length <= MAX_HEADLINE) return first;
  const cut = first.slice(0, MAX_HEADLINE);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MIN_HEADLINE ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

function rollRarity(hash) {
  const roll = (hash % 1_000_000) / 10_000;
  let cursor = 0;
  for (const id of RARITY_ORDER) {
    cursor += RARITIES[id].pullRate;
    if (roll < cursor) return RARITIES[id];
  }
  return RARITIES.common;
}

const SERIAL_ALPHABET = "0123456789ABCDEF";

function makeSerial(hash) {
  let out = "";
  let n = hash;
  for (let i = 0; i < 4; i++) {
    out += SERIAL_ALPHABET[n % SERIAL_ALPHABET.length];
    n = Math.floor(n / SERIAL_ALPHABET.length);
  }
  return out;
}

function mintCard(username, roast) {
  const basis = `${username}::${roast}`;
  return {
    rarity: rollRarity(fnv1a(basis)),
    serial: makeSerial(fnv1a(basis, 0x27d4eb2f)),
    headline: extractBestLine(roast),
  };
}

module.exports = { mintCard, extractBestLine, stripMarkdown, RARITIES, RARITY_ORDER };
