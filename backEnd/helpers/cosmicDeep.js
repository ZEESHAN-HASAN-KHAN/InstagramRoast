const { callLLM } = require("./llmProvider");
const { buildPrompt } = require("./prompts");
const { signForDate, chemistryFor, modalityNote } = require("./zodiac");
const logger = require("./logger");

// The paid half of Cosmic Match: a sectioned deep reading, sold once per
// pairing-plus-dates.
//
// One gate, not six. The free match already gives away a score, two flags and a
// verdict; what is sold here is *length and specificity*, which is the only
// thing a reader cannot infer from the teaser. Locking each section behind its
// own price was the mistake the roast page made — a wall of padlocks reads as
// spam and converts worse than a single honest one.
//
// Structured JSON rather than markdown because every section is a separate card
// on screen, and splitting prose back into sections by heading is a guessing
// game the moment the model translates the headings into another language.

// Fixed section list. The model fills these keys and no others: a free-form
// section array would drift in count and break the layout, and the order here
// is the order they are read on the page — escalating from banter to the two
// sections people actually paid for (the forecast and the fix).
const SECTIONS = [
  // `planet` is the classical ruler of what the section is about. Fixed per
  // section rather than asked of the model: the mapping is a convention, not a
  // judgement, and a model inventing its own would drift between runs. It
  // renders as a slowly turning watermark behind each card, which lines the
  // artwork up with copy that already says things like "Mercury compels".
  { key: "loveLanguage", title: "How you each show up", icon: "\u{1F495}", planet: "\u2640" },
  { key: "communication", title: "Who texts first", icon: "\u{1F4AC}", planet: "\u263F" },
  { key: "theFight", title: "The fight you will keep having", icon: "\u{26A1}", planet: "\u2642" },
  { key: "chemistry", title: "The chemistry", icon: "\u{1F525}", planet: "\u2647" },
  { key: "forecast", title: "Six-month forecast", icon: "\u{1F52E}", planet: "\u263D" },
  { key: "theFix", title: "What would have to change", icon: "\u{1F527}", planet: "\u2644" },
];

// How a section lands, used to tint its card and pick its omen badge.
//
// Asked of the model rather than derived on the client, because the client
// would have to do it by keyword and the reading is written in whichever of the
// ten supported languages the user picked. A Spanish or Hinglish reading would
// score neutral against every English keyword list.
//
// Three values, deliberately: enough to be worth rendering, few enough that the
// model picks consistently. Anything unrecognised degrades to "tense", the
// middle one, so a hallucinated tone can never render as a blessing.
const TONES = ["blessed", "tense", "cursed"];
const normaliseTone = (value) => {
  const tone = String(value ?? "").trim().toLowerCase();
  return TONES.includes(tone) ? tone : "tense";
};

// Deliberately plain — the tuned template lives in PROMPT_COSMIC_DEEP. See
// helpers/prompts.js for why the good version is not in the repo.
const COSMIC_DEEP_FALLBACK = `You are a brutally funny astrologer writing the full paid reading for two people who already saw the free summary.

Person A - @{{username1}}, a {{sign1}} ({{element1}}):
{{profile1}}

Person B - @{{username2}}, a {{sign2}} ({{element2}}):
{{profile2}}

Already worked out - do not recalculate:
- Elements: {{chemistry}}
- Shared trait: {{modalityNote}}

They already read this and paid for more, so do NOT repeat it:
{{freeSummary}}

Write six sections. Each is 2 to 3 sentences, specific to these two profiles, funny and mean but never cruel about appearance, health, race or money. Name the signs. Blame planets.
Write strictly in {{language}}.

Return ONLY a JSON object, no markdown fence, no commentary. The six section keys are strings. "tones" is an object with the same six keys, each set to blessed, tense, or cursed depending on how that section lands for them:
{"loveLanguage":"","communication":"","theFight":"","chemistry":"","forecast":"","theFix":"","tones":{"loveLanguage":"","communication":"","theFight":"","chemistry":"","forecast":"","theFix":""}}

loveLanguage: how each of them shows affection and why it misses the other.
communication: who texts first, who leaves it on read, what their DMs look like.
theFight: the specific argument they will have on repeat, and who wins.
chemistry: the pull between them. Suggestive at most, never explicit.
theFix: the one honest thing that would actually have to change. This is the only section allowed to be useful.
forecast: month by month, how the next six months go. End it somewhere definite.`;

// Models wrap JSON in fences, prepend "Here is", or emit smart quotes. Rather
// than tightening the prompt forever, the response is salvaged: find the outer
// braces and parse what is inside.
function extractJson(raw) {
  const text = String(raw ?? "").trim();

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    logger.warning("[cosmicDeep] response was not valid JSON", { error: error.message });
    return null;
  }
}

// Returns the section list the UI renders. A section the model skipped is
// dropped rather than shown empty — six cards with one blank reads as a bug,
// five cards reads as the reading.
function parseDeepReading(raw) {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object") return null;

  // Tones arrive in a sibling object keyed the same way, rather than turning
  // every section into a nested {body, tone} pair. Models fill a flat string
  // map markedly more reliably than a map of objects, and a malformed tones
  // block then costs the decoration but never the reading itself.
  const tones = parsed.tones && typeof parsed.tones === "object" ? parsed.tones : {};

  const sections = SECTIONS.map(({ key, title, icon, planet }) => {
    const body = parsed[key];
    if (typeof body !== "string" || !body.trim()) return null;
    return { key, title, icon, planet, body: body.trim(), tone: normaliseTone(tones[key]) };
  }).filter(Boolean);

  // A response that yielded almost nothing is a failed generation, not a short
  // reading — better to surface the error and refund than to charge for two
  // paragraphs.
  return sections.length >= 3 ? { sections } : null;
}

const generateCosmicDeep = async (userData1, userData2, language, dob1, dob2, freeSummary) => {
  const sign1 = signForDate(dob1);
  const sign2 = signForDate(dob2);

  const inputPrompt = buildPrompt("PROMPT_COSMIC_DEEP", COSMIC_DEEP_FALLBACK, {
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
    chemistry: chemistryFor(sign1, sign2) ?? "one of them would not say when they were born",
    modalityNote: modalityNote(sign1, sign2) ?? "No shared modality.",
    // The free text is handed over so the paid reading does not resell it back
    // to them — the single most common complaint about upsold AI content.
    freeSummary: String(freeSummary ?? "").slice(0, 1200),
    language,
  });

  logger.debug("LLM input prompt", { prompt: inputPrompt });
  return parseDeepReading(await callLLM(inputPrompt));
};

module.exports = { generateCosmicDeep, parseDeepReading, SECTIONS };
