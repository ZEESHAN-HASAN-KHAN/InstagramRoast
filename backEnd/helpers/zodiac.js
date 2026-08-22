// Western tropical sun signs, plus the element/modality pairing logic the
// Cosmic Match prompt leans on.
//
// Why compute this server-side instead of asking the LLM: sun signs are pure
// arithmetic on a date, and models get the cusp days wrong often enough that a
// user born on the 22nd sees the wrong sign and stops trusting the whole
// reading. The LLM is good at the voice, not the ephemeris — so it is handed
// the finished astrology and only asked to be funny about it.
//
// Deliberately sun-sign only. A real natal chart needs birth *time* and place,
// and asking for three fields instead of one would cost more conversions than
// the extra accuracy is worth. See docs on the feature for the tradeoff.

// Each entry: sign starts on `day` of `month` (1-indexed month) and runs until
// the next entry's start. Capricorn wraps the year, so it appears twice.
const SIGN_RANGES = [
  { month: 1, day: 1, name: "Capricorn" },
  { month: 1, day: 20, name: "Aquarius" },
  { month: 2, day: 19, name: "Pisces" },
  { month: 3, day: 21, name: "Aries" },
  { month: 4, day: 20, name: "Taurus" },
  { month: 5, day: 21, name: "Gemini" },
  { month: 6, day: 21, name: "Cancer" },
  { month: 7, day: 23, name: "Leo" },
  { month: 8, day: 23, name: "Virgo" },
  { month: 9, day: 23, name: "Libra" },
  { month: 10, day: 23, name: "Scorpio" },
  { month: 11, day: 22, name: "Sagittarius" },
  { month: 12, day: 22, name: "Capricorn" },
];

const SIGN_META = {
  Aries: { emoji: "♈", element: "fire", modality: "cardinal", ruler: "Mars", vibe: "starts everything, finishes nothing" },
  Taurus: { emoji: "♉", element: "earth", modality: "fixed", ruler: "Venus", vibe: "immovable, and smug about it" },
  Gemini: { emoji: "♊", element: "air", modality: "mutable", ruler: "Mercury", vibe: "two personalities, neither reliable" },
  Cancer: { emoji: "♋", element: "water", modality: "cardinal", ruler: "Moon", vibe: "remembers everything, forgives nothing" },
  Leo: { emoji: "♌", element: "fire", modality: "fixed", ruler: "Sun", vibe: "needs an audience to exist" },
  Virgo: { emoji: "♍", element: "earth", modality: "mutable", ruler: "Mercury", vibe: "fixing you without being asked" },
  Libra: { emoji: "♎", element: "air", modality: "cardinal", ruler: "Venus", vibe: "cannot pick a restaurant" },
  Scorpio: { emoji: "♏", element: "water", modality: "fixed", ruler: "Pluto", vibe: "read it, will not reply" },
  Sagittarius: { emoji: "♐", element: "fire", modality: "mutable", ruler: "Jupiter", vibe: "honest when nobody asked" },
  Capricorn: { emoji: "♑", element: "earth", modality: "cardinal", ruler: "Saturn", vibe: "scheduled this conversation" },
  Aquarius: { emoji: "♒", element: "air", modality: "fixed", ruler: "Uranus", vibe: "contrarian as a personality" },
  Pisces: { emoji: "♓", element: "water", modality: "mutable", ruler: "Neptune", vibe: "crying about a text from 2019" },
};

// Accepts anything Date can parse, but the intended input is the "YYYY-MM-DD"
// an <input type="date"> produces. Parsed by hand rather than via `new Date()`
// because `new Date("1999-07-23")` is treated as UTC midnight and shifts back a
// day for anyone west of Greenwich — which silently changes their sign.
function parseBirthDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Reject impossible dates (Feb 30) that the range check above lets through.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  // Anything outside a plausible human birth year is a typo or a bot.
  const thisYear = new Date().getUTCFullYear();
  if (year < 1900 || year > thisYear) return null;

  return { year, month, day };
}

function signForDate(value) {
  const parsed = parseBirthDate(value);
  if (!parsed) return null;

  // Walk backwards to the last range that has already started this year.
  let name = SIGN_RANGES[0].name;
  for (const range of SIGN_RANGES) {
    if (parsed.month > range.month || (parsed.month === range.month && parsed.day >= range.day)) {
      name = range.name;
    }
  }

  return { name, ...SIGN_META[name] };
}

// How the two elements read together. This is the actual astrological content
// of the feature — the prompt turns this into jokes rather than inventing its
// own (inconsistent) take on whether fire and water get along.
const ELEMENT_CHEMISTRY = {
  "fire|fire": "two people trying to win the same argument forever",
  "fire|earth": "one wants to leave right now, the other already unpacked",
  "fire|air": "genuinely combustible, in both directions",
  "fire|water": "one burns out, the other floods — someone is always overreacting",
  "earth|earth": "stable, and quietly bored by month four",
  "earth|air": "one makes plans, the other makes theories",
  "earth|water": "the healthiest pairing here, which is its own kind of boring",
  "air|air": "endless conversation, zero follow-through",
  "air|water": "one intellectualises feelings, the other drowns in them",
  "water|water": "a shared emotional support animal situation",
};

function chemistryFor(signA, signB) {
  if (!signA || !signB) return null;
  const pair = [signA.element, signB.element].sort().join("|");
  // Sorted lookup means fire|water and water|fire hit the same entry, so the
  // reading does not change depending on who typed their handle first.
  const key = ELEMENT_CHEMISTRY[pair] ? pair : `${signA.element}|${signB.element}`;
  return ELEMENT_CHEMISTRY[key] ?? null;
}

// Same-modality pairs are the classic friction case (two cardinal signs both
// want to lead, two fixed signs both refuse to move). Surfaced separately so
// the prompt can reach for it when the elements alone are unremarkable.
function modalityNote(signA, signB) {
  if (!signA || !signB || signA.modality !== signB.modality) return null;
  return {
    cardinal: "both of you need to be the one who decides",
    fixed: "neither of you has ever changed your mind on purpose",
    mutable: "neither of you will commit to a plan, including this one",
  }[signA.modality] ?? null;
}

module.exports = { signForDate, parseBirthDate, chemistryFor, modalityNote, SIGN_META };
