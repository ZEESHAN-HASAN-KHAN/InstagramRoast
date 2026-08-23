const fs = require("fs");
const logger = require("./logger");

// Prompt templates live in the environment, not in this repo.
//
// The roast voice is the product. Once it is in a public file anyone can lift
// it verbatim, and a competitor gets the tuned version for free. Keeping the
// template in `.env` (gitignored) means the code ships the *pipeline* and the
// operator ships the *voice*, and the voice can be retuned with a restart
// instead of a deploy.
//
// Two ways to supply one, both read at call time so edits need no rebuild:
//   PROMPT_X="line one\nline two"      → the template inline (dotenv keeps
//                                        real newlines inside double quotes)
//   PROMPT_X="file:/run/secrets/x.txt" → path to a file holding the template,
//                                        for prompts too long to live on one
//                                        .env line comfortably
//
// A missing var IS an error. This used to keep a plain-English fallback next to
// every call site so a fresh clone still ran, but a fallback good enough to ship
// behind is a fallback worth stealing — the repo ended up carrying a working
// copy of the exact thing the .env was hiding. There is now no prompt text in
// this repo at all. `PROMPTS.md` documents the keys and their placeholders
// without quoting a line of the voice — it is gitignored and kept with the
// .env, so a clone will not have it. REQUIRED_PROMPTS below is the list that
// does travel with the code.
//
// Consequences, both deliberate:
//   - a clone with no .env cannot generate. It fails at boot with the list of
//     missing keys (see assertPromptsConfigured) rather than silently roasting
//     in some untuned default voice nobody reviewed.
//   - a typo'd key name is loud instead of invisible.

// file: templates are read from disk on every call, which would be a real cost
// on the hot path. Cached by path+mtime so an edit is still picked up without a
// restart, but an unchanged file is read once.
const fileCache = new Map();

function readTemplateFile(path) {
  let stat;
  try {
    stat = fs.statSync(path);
  } catch (error) {
    logger.error("[prompts] template file unreadable", { path, error: error.message });
    return null;
  }

  const cached = fileCache.get(path);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.text;

  try {
    const text = fs.readFileSync(path, "utf8");
    fileCache.set(path, { mtimeMs: stat.mtimeMs, text });
    return text;
  } catch (error) {
    logger.error("[prompts] template file read failed", { path, error: error.message });
    return null;
  }
}

class MissingPromptError extends Error {
  constructor(envKey, detail) {
    super(`Prompt template ${envKey} is not configured${detail ? ` (${detail})` : ""}`);
    this.name = "MissingPromptError";
    this.envKey = envKey;
  }
}

function loadTemplate(envKey) {
  const raw = process.env[envKey];
  if (!raw || !raw.trim()) throw new MissingPromptError(envKey);

  if (raw.startsWith("file:")) {
    const path = raw.slice(5).trim();
    const text = readTemplateFile(path);
    // An unreadable file is a deployment fault, not a reason to improvise. The
    // error above already logged why; this stops the request.
    if (text === null) throw new MissingPromptError(envKey, `file: ${path} unreadable`);
    return text;
  }

  // dotenv unescapes \n and \t inside a double-quoted value but leaves \" and
  // \\ alone. A template that shows the model a JSON shape therefore arrives
  // with a visible backslash before every quote — which the model copies
  // straight into its output. Finish the unescaping here.
  //
  // One pass rather than chained .replace calls: sequential passes would turn
  // the two-character sequence \\" into a bare quote, and an author writing
  // about escaping is the one person who needs that left alone.
  return raw.replace(/\\([nrt"'\\])/g, (_match, ch) => {
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "\t";
    return ch;
  });
}

// {{name}} substitution. Deliberately not a full template engine: an unknown
// placeholder is left in place rather than blanked, so a typo in a hand-edited
// .env shows up as a visible `{{usrname}}` in the logged prompt instead of
// silently sending the model an empty slot.
function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : match
  );
}

function buildPrompt(envKey, vars) {
  return render(loadTemplate(envKey), vars);
}

// Every prompt key the app needs to function. Checked once at boot so a
// misconfigured deploy fails on startup with the full list, instead of one
// missing key surfacing hours later as a single failed roast.
const REQUIRED_PROMPTS = [
  "PROMPT_ROAST",
  "PROMPT_ROAST_ANGLES",
  "PROMPT_ROAST_REROLL",
  "PROMPT_COMPAT_ROAST",
  "PROMPT_COSMIC_MATCH",
  "PROMPT_COSMIC_DEEP",
];

function missingPrompts() {
  return REQUIRED_PROMPTS.filter((key) => {
    const raw = process.env[key];
    return !raw || !raw.trim();
  });
}

function assertPromptsConfigured() {
  const missing = missingPrompts();
  if (missing.length === 0) return;
  // Thrown, not logged-and-continued: a server that boots without a voice
  // accepts traffic it cannot serve. The message names the missing keys rather
  // than pointing at PROMPTS.md, which is gitignored and may not be on the box.
  throw new Error(
    `Missing prompt templates: ${missing.join(", ")}. ` +
      `Set them in .env or as environment variables.`
  );
}

module.exports = {
  buildPrompt,
  loadTemplate,
  render,
  assertPromptsConfigured,
  missingPrompts,
  MissingPromptError,
  REQUIRED_PROMPTS,
};
