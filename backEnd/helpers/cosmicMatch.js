const { callLLM } = require("./llmProvider");
const { buildPrompt } = require("./prompts");
const { signForDate, chemistryFor, modalityNote, scoreBandFor } = require("./zodiac");
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


// Splits the model's single string into the pieces the UI renders separately.
// Every field except `text` is optional by design: a model that ignores the
// shape still yields usable prose, so a malformed response degrades to the
// plain-markdown experience instead of an error page.
function parseCosmicMatch(raw, sign1, sign2, band = null) {
  const text = String(raw ?? "");

  const scoreMatch = SCORE_MARKER.exec(text);
  // Clamped rather than rejected — a model that answers 120 meant "very high",
  // and dropping the score over that is a worse outcome than showing 100.
  //
  // Clamped to the astrological band rather than to 0-100 when we have one.
  // Asking nicely is not enough on its own: the prompt is a long instruction to
  // be cruel, and the first production readings all landed under 13 because the
  // model scored the tone instead of the pairing. The band is the guarantee,
  // the prompt line is what keeps the number from pinning to an edge of it.
  const lo = band ? band.min : 0;
  const hi = band ? band.max : 100;
  const score = scoreMatch ? Math.min(hi, Math.max(lo, Number(scoreMatch[1]))) : null;

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
  const band = scoreBandFor(sign1, sign2);

  const inputPrompt = buildPrompt("PROMPT_COSMIC_MATCH", {
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
    //
    // These two stand-ins are deliberately flat statements of fact rather than
    // jokes. Any line with a voice in it belongs in the template with the rest
    // of the voice — a funny default here is one more thing the repo leaks.
    chemistry: chemistry ?? "not available - only one birth date was given",
    modalityNote: modality ?? "no shared modality",
    // With only one birth date there is no element pairing to derive a band
    // from, so the model gets the full scale back and the clamp below stands
    // down. Half an astrology chart should not pin everyone to one number.
    scoreMin: band ? band.min : 0,
    scoreMax: band ? band.max : 100,
    language,
  });

  logger.debug("LLM input prompt", { prompt: inputPrompt });
  const raw = await callLLM(inputPrompt);
  return parseCosmicMatch(raw, sign1, sign2, band);
};

module.exports = { generateCosmicMatch, parseCosmicMatch };
