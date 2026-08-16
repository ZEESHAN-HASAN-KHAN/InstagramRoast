// The aura a profile carries around the site once its roast card has been
// pulled: a lit inner border in the tier's colour, with fire licking up from
// the bottom edge — the card's rarity, worn on every surface the profile
// appears on.
//
// Lit inward rather than a soft outer bloom: an outer glow reads as a drop
// shadow at a glance, especially on a dark page full of cards that already have
// one. Burning the border and the inside edge is what makes the tier legible
// from across a grid.
//
// Deliberately separate from cardRarity.ts — that file is the mint, pinned
// character-for-character against its backend twin by
// scripts/checkCardIdentityParity.js. Presentation constants have no business
// living inside something that has to stay byte-comparable.
//
// The rule the whole feature rests on: an aura means *someone flipped that card
// face-up*. A profile whose card is still face-down shows nothing, so the glow
// stays a signal rather than decoration everybody has.
//
// The panel half of this lives in my_components/CardAura.tsx; the tokens are
// here so both halves read from one table.

import type { CSSProperties } from "react";
import { RARITIES, type RarityId } from "./cardRarity";

type Aura = {
  /** Core colour as an `r g b` triple, so CSS can vary alpha per layer. */
  rgb: string;
  /** Second colour, only distinct on diamond — the holo card can't be one hue. */
  rgb2?: string;
  /** Base radius of the light thrown past the edge. */
  spread: number;
  /** Seconds per breath. Rarer pulls breathe faster, so they read as "alive". */
  speed: number;
};

// Colours track the card skins in RoastTradingCard so the glow on a leaderboard
// row and the card it came from are recognisably the same object.
const AURAS: Record<RarityId, Aura> = {
  // Common is the floor, not a prize: a warm grey ember. Still present, because
  // "this card has been opened" is the thing being communicated.
  common: { rgb: "180 174 170", spread: 12, speed: 5 },
  crispy: { rgb: "249 115 22", spread: 16, speed: 3.8 },
  nuclear: { rgb: "239 68 68", spread: 20, speed: 3.2 },
  golden: { rgb: "234 179 8", spread: 24, speed: 2.7 },
  diamond: { rgb: "167 139 250", rgb2: "34 211 238", spread: 28, speed: 2.2 },
};

const IDS = new Set(Object.keys(AURAS));

/** Narrows whatever the API returned — the column is free text in the DB. */
export function asRarityId(value: string | null | undefined): RarityId | null {
  return value && IDS.has(value) ? (value as RarityId) : null;
}

/** The custom properties every aura rule in index.css reads. */
export function auraVars(tier: RarityId, intensity: number): CSSProperties {
  const aura = AURAS[tier];
  return {
    "--aura": aura.rgb,
    "--aura-2": aura.rgb2 ?? aura.rgb,
    "--aura-spread": `${Math.round(aura.spread * intensity)}px`,
    "--aura-speed": `${aura.speed}s`,
  } as CSSProperties;
}

/** Names the tier for anyone who can't read a colour. */
export const auraTitle = (tier: RarityId) =>
  `${RARITIES[tier].emoji} ${RARITIES[tier].name} card pulled`;

export type AuraRingProps = {
  className: string;
  style: CSSProperties;
  title: string;
};

/**
 * Props to spread onto an avatar so its ring burns in the tier's colour.
 * Returns null for an unpulled card, which is the caller's cue to render the
 * element exactly as it was.
 *
 * Avatars get the ring and not the fire: at 32px a flame is noise, and the
 * inset glow an `<img>` would need is painted under its own picture anyway.
 *
 * @param intensity multiplier on the thrown light — a 32px avatar and a 96px
 *                  one need different amounts for the same perceived strength
 */
export function auraRing(
  tier: RarityId | null | undefined,
  intensity = 1
): AuraRingProps | null {
  if (!tier) return null;
  return {
    className: "card-aura-ring",
    style: auraVars(tier, intensity),
    title: auraTitle(tier),
  };
}
