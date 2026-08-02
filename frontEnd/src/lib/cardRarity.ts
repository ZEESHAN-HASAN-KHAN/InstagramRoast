// Every roast mints a collectible card, and its rarity is a dice roll. The roll
// is derived from the roast text itself rather than Math.random so a card is
// stable across re-renders, refreshes and shares — the screenshot someone posts
// always matches what the page shows. A paid re-roast produces different text,
// which is what makes it a genuinely fresh pull.

export type RarityId = "common" | "crispy" | "nuclear" | "golden" | "diamond";

export type Rarity = {
  id: RarityId;
  /** Shown on the card face. */
  name: string;
  emoji: string;
  /** Chance of pulling this tier, as a percentage. Printed on the card — the
   *  number is half the reason a rare pull gets posted. */
  pullRate: number;
  /** Copy under the reveal, addressed to the person who pulled it. */
  tagline: string;
  /** How long the pre-flip suspense runs. Rarer pulls stall longer: the pause
   *  itself is the tell, exactly like every card-opening video. */
  suspenseMs: number;
  /** Confetti colours for the reveal burst. */
  confettiColors: string[];
};

// Ordered worst → best. Weights are the pullRate values and must total 100.
export const RARITIES: Record<RarityId, Rarity> = {
  common: {
    id: "common",
    name: "Mid Roast",
    emoji: "🥴",
    pullRate: 55,
    tagline: "everyone gets one of these. re-roll for something worth posting.",
    suspenseMs: 500,
    confettiColors: ["#9ca3af", "#d1d5db", "#6b7280"],
  },
  crispy: {
    id: "crispy",
    name: "Extra Crispy",
    emoji: "🔥",
    pullRate: 28,
    tagline: "properly cooked. not legendary, but it stings.",
    suspenseMs: 800,
    confettiColors: ["#f97316", "#fb923c", "#ef4444"],
  },
  nuclear: {
    id: "nuclear",
    name: "Nuclear Burn",
    emoji: "🌶️",
    pullRate: 12,
    tagline: "1 in 8 roasts hit this hard. post it.",
    suspenseMs: 1200,
    confettiColors: ["#dc2626", "#f97316", "#fbbf24", "#7f1d1d"],
  },
  golden: {
    id: "golden",
    name: "Golden Roast",
    emoji: "👑",
    pullRate: 4.5,
    tagline: "gold foil. 1 in 22 people ever see this card.",
    suspenseMs: 1700,
    confettiColors: ["#fbbf24", "#f59e0b", "#fde68a", "#d97706"],
  },
  diamond: {
    id: "diamond",
    name: "Diamond Burn",
    emoji: "💎",
    pullRate: 0.5,
    tagline: "1 in 200. you will not pull this again. screenshot it now.",
    suspenseMs: 2400,
    confettiColors: ["#22d3ee", "#a78bfa", "#f472b6", "#facc15", "#4ade80"],
  },
};

export const RARITY_ORDER: RarityId[] = ["common", "crispy", "nuclear", "golden", "diamond"];

// FNV-1a. Cheap, dependency-free, and spreads small text changes across the
// whole 32-bit range — which matters here because two roasts of the same person
// often differ by only a few words.
function fnv1a(input: string, seed = 0x811c9dc5): number {
  let hash = seed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type RoastCardIdentity = {
  rarity: Rarity;
  /** Short printed code, e.g. "A7F3" — collectible flavour, no backend needed. */
  serial: string;
  /** The single line printed large on the card face. */
  headline: string;
};

// Strips the markdown the LLM emits so card text never renders raw `**` or `#`.
export function stripMarkdown(md: string): string {
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

const MIN_HEADLINE = 40;
const MAX_HEADLINE = 165;

// The roast prompt forbids headings, so any that slip through are label junk
// ("Roast", "Hot Take") that would otherwise be glued onto the front of the
// punchline. Dropped only when there's real content left without them.
function dropHeadingLines(md: string): string {
  const kept = md.split(/\r?\n/).filter((line) => !/^\s{0,3}#{1,6}\s+/.test(line));
  return kept.join("\n").trim() ? kept.join("\n") : md;
}

// Picks the one line worth printing three times larger than everything else.
// Prefers a whole sentence in a readable length band; falls back to a clean
// word-boundary truncation so the card is never empty or mid-word.
export function extractBestLine(roast: string): string {
  const text = stripMarkdown(dropHeadingLines(roast));
  if (!text) return "";

  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const inBand = sentences.filter(
    (s) => s.length >= MIN_HEADLINE && s.length <= MAX_HEADLINE
  );
  // Among candidates, the longest one in the band carries the most punchline.
  if (inBand.length) {
    return inBand.reduce((best, s) => (s.length > best.length ? s : best));
  }

  const first = sentences[0] ?? text;
  if (first.length <= MAX_HEADLINE) return first;
  const cut = first.slice(0, MAX_HEADLINE);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MIN_HEADLINE ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

function rollRarity(hash: number): Rarity {
  // 0…100 with four decimals of resolution, so a 0.5% tier is actually reachable.
  const roll = (hash % 1_000_000) / 10_000;
  let cursor = 0;
  for (const id of RARITY_ORDER) {
    cursor += RARITIES[id].pullRate;
    if (roll < cursor) return RARITIES[id];
  }
  return RARITIES.common;
}

const SERIAL_ALPHABET = "0123456789ABCDEF";

function makeSerial(hash: number): string {
  let out = "";
  let n = hash;
  for (let i = 0; i < 4; i++) {
    out += SERIAL_ALPHABET[n % SERIAL_ALPHABET.length];
    n = Math.floor(n / SERIAL_ALPHABET.length);
  }
  return out;
}

// The roast text is the whole entropy source: same roast → same card, new roast
// → new pull. Username is mixed in only so two people who somehow get identical
// roast text don't share a serial.
export function mintCard(username: string, roast: string): RoastCardIdentity {
  const basis = `${username}::${roast}`;
  return {
    rarity: rollRarity(fnv1a(basis)),
    // A second, differently-seeded pass keeps the printed serial from being a
    // readable function of the tier.
    serial: makeSerial(fnv1a(basis, 0x27d4eb2f)),
    headline: extractBestLine(roast),
  };
}
