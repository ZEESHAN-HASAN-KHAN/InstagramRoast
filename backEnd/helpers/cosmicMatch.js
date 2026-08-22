const { callLLM } = require("./llmProvider");
const { buildPrompt } = require("./prompts");
const { signForDate, chemistryFor, modalityNote } = require("./zodiac");
const logger = require("./logger");

// Cosmic Match — the astrology-framed pairing read.
//
// Kept out of apiHelper.js and separate from generateAICompatiblityRoast
// because the two produce a different artefact. The old compatibility roast
// returns one blob of markdown; this returns a score, two flags and a verdict
// as distinct fields the UI renders as separate elements. The old one stays
// for pairings where neither person gave a birth date.
//
// All astrology is computed in zodiac.js and handed to the model finished. The
// model's only job is the voice — asking it to also work out sun signs gets
// cusp birthdays wrong, and a user who sees the wrong sign stops trusting
// every other word on the page.

// The score rides out-of-band on a trailing marker rather than being asked for
// in prose, so it can be stored and rendered as a real UI element instead of
// being regexed out of a joke. Stripped from the text before display.
const SCORE_MARKER = /\[\[\s*score\s*:\s*(\d{1,3})\s*\]\]/i;

const GREEN = "\u{1F7E2}";
const RED = "\u{1F534}";
const SKULL = "\u{1F480}";

// Deliberately plain. The tuned template lives in PROMPT_COSMIC_MATCH; this is
// only what a fresh clone falls back to so the pipeline still runs. See
// helpers/prompts.js for why the good version is not in the repo.
const COSMIC_MATCH_FALLBACK = `You are a brutally funny astrologer who has read both of these people's Instagram profiles and is not impressed by either.

Person A — @{{username1}} ({{sign1}}, {{element1}}):
{{profile1}}

Person B — @{{username2}} ({{sign2}}, {{element2}}):
{{profile2}}

The astrology, already worked out for you — do not recalculate it:
- Elements: {{chemistry}}
- {{modalityNote}}

Write a compatibility reading that roasts BOTH of them and the pairing itself.
Ground every joke in something specific from their actual profiles — follower counts, the bio, post count, the gap between the two accounts. A line that would fit any couple is a failure.
Write strictly in {{language}}.

OUTPUT SHAPE — get this wrong and the whole reading is discarded:
- LINE 1: one sentence, 40 to 130 characters, ZERO emoji, no markdown, no quotes, no labels. It is printed alone on a shareable card, so it must land with no context around it.
- Then a blank line.
- Then a line starting with ${GREEN}: the one thing that genuinely works between them. Still funny, not kind.
- Then a line starting with ${RED}: the thing that ends it.
- Then a blank line.
- Then two or three sentences of body. Do not repeat line 1.
- Then a blank line.
- Then a line starting with ${SKULL}: the verdict — how this actually plays out, in one sentence.
- Then, on the very last line with nothing after it: [[score:N]] where N is 0-100, how compatible they really are. Be willing to use the extremes.

NO titles, headers, sign-offs, meta-commentary, or "Here is your reading". Start immediately with line 1.`;

// Splits the model's single string into the pieces the UI renders separately.
// Every field except `text` is optional by design: a model that ignores the
// shape still yields usable prose, so a malformed response degrades to the
// plain-markdown experience instead of an error page.
function parseCosmicMatch(raw, sign1, sign2) {
  const text = String(raw ?? "");

  const scoreMatch = SCORE_MARKER.exec(text);
  // Clamped rather than rejected — a model that answers 120 meant "very high",
  // and dropping the score over that is a worse outcome than showing 100.
  const score = scoreMatch ? Math.min(100, Math.max(0, Number(scoreMatch[1]))) : null;

  const body = text.replace(SCORE_MARKER, "").trim();
  const lines = body.split("\n");

  const pick = (emoji) => {
    const line = lines.find((l) => l.trim().startsWith(emoji));
    if (!line) return null;
    const value = line.trim().slice(emoji.length).trim();
    return value || null;
  };

  const asSign = (sign) =>
    sign ? { name: sign.name, emoji: sign.emoji, element: sign.element } : null;

  return {
    text: body,
    score,
    greenFlag: pick(GREEN),
    redFlag: pick(RED),
    verdict: pick(SKULL),
    sign1: asSign(sign1),
    sign2: asSign(sign2),
  };
}

const generateCosmicMatch = async (userData1, userData2, language, dob1, dob2) => {
  const sign1 = signForDate(dob1);
  const sign2 = signForDate(dob2);
  const chemistry = chemistryFor(sign1, sign2);
  const modality = modalityNote(sign1, sign2);

  const inputPrompt = buildPrompt("PROMPT_COSMIC_MATCH", COSMIC_MATCH_FALLBACK, {
    username1: userData1.username,
    username2: userData2.username,
    profile1: JSON.stringify(userData1),
    profile2: JSON.stringify(userData2),
    sign1: sign1 ? sign1.name : "unknown sign",
    sign2: sign2 ? sign2.name : "unknown sign",
    element1: sign1 ? sign1.element : "unknown",
    element2: sign2 ? sign2.element : "unknown",
    vibe1: sign1 ? sign1.vibe : "",
    vibe2: sign2 ? sign2.vibe : "",
    ruler1: sign1 ? sign1.ruler : "",
    ruler2: sign2 ? sign2.ruler : "",
    // A pairing where only one person gave a birth date still runs. The prompt
    // just has less to work with, which beats refusing and losing the run.
    chemistry: chemistry ?? "one of them would not say when they were born, which is its own red flag",
    modalityNote: modality ?? "No shared modality — at least you disagree about different things.",
    language,
  });

  logger.debug("LLM input prompt", { prompt: inputPrompt });
  const raw = await callLLM(inputPrompt);
  return parseCosmicMatch(raw, sign1, sign2);
};

module.exports = { generateCosmicMatch, parseCosmicMatch, COSMIC_MATCH_FALLBACK };
