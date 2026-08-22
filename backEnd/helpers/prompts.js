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
// A missing var is not an error: every caller passes a built-in fallback so a
// fresh clone still runs. Only the tuned versions are secret.

// file: templates are read from disk on every call, which would be a real cost
// on the hot path. Cached by path+mtime so an edit is still picked up without a
// restart, but an unchanged file is read once.
const fileCache = new Map();

function readTemplateFile(path) {
  let stat;
  try {
    stat = fs.statSync(path);
  } catch (error) {
    logger.error("[prompts] template file unreadable, using fallback", { path, error: error.message });
    return null;
  }

  const cached = fileCache.get(path);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.text;

  try {
    const text = fs.readFileSync(path, "utf8");
    fileCache.set(path, { mtimeMs: stat.mtimeMs, text });
    return text;
  } catch (error) {
    logger.error("[prompts] template file read failed, using fallback", { path, error: error.message });
    return null;
  }
}

function loadTemplate(envKey, fallback) {
  const raw = process.env[envKey];
  if (!raw || !raw.trim()) return fallback;

  if (raw.startsWith("file:")) {
    return readTemplateFile(raw.slice(5).trim()) ?? fallback;
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

function buildPrompt(envKey, fallback, vars) {
  return render(loadTemplate(envKey, fallback), vars);
}

module.exports = { buildPrompt, loadTemplate, render };
