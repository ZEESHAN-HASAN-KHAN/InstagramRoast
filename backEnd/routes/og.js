const express = require("express");
const ogRouter = express.Router();
const logger = require("../helpers/logger");
const { ensureOgImage, ensureOgMeta } = require("../helpers/ogStore");

// Link-preview endpoints. Both are mounted ahead of the JWT middleware in
// index.js on purpose: the callers are Facebook, WhatsApp, Twitter and Slack
// crawlers, which cannot present a token and will simply drop the preview if
// they get a 401.
//
// Nothing here exposes anything the roast page does not already show publicly.

const ALLOWED_LANGUAGES = (process.env.ALLOWED_LANGUAGE || "english")
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean);

// The page defaults to english when no ?language= is present, so the preview
// has to make the same choice or it would advertise a different roast than the
// visitor lands on.
function parseLanguage(value) {
  return ALLOWED_LANGUAGES.includes(value) ? value : "english";
}

// Instagram handles are ASCII; rejecting anything else keeps a crafted path
// from reaching the database or the storage key.
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

ogRouter.get("/og-image/:username.jpg", async (req, res) => {
  const username = req.params.username;
  if (!HANDLE.test(username)) return res.status(400).end();

  try {
    const result = await ensureOgImage(username, parseLanguage(req.query.language));
    if (!result) return res.status(404).end();

    res.set({
      "Content-Type": "image/jpeg",
      // Crawlers re-fetch aggressively and the image only changes when the
      // roast does — at which point the URL changes with it.
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "Content-Length": result.buffer.length,
    });
    return res.end(result.buffer);
  } catch (err) {
    logger.error("[og] image render failed", { username, error: err.message });
    return res.status(500).end();
  }
});

ogRouter.get("/og-meta/:username", async (req, res) => {
  const username = req.params.username;
  if (!HANDLE.test(username)) return res.status(400).json({ error: "bad handle" });

  try {
    const origin = process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get("host")}`;
    const meta = await ensureOgMeta(username, parseLanguage(req.query.language), origin);
    if (!meta) return res.status(404).json({ error: "no roast" });

    res.set("Cache-Control", "public, max-age=300");
    return res.json(meta);
  } catch (err) {
    logger.error("[og] meta lookup failed", { username, error: err.message });
    return res.status(500).json({ error: "failed" });
  }
});

module.exports = ogRouter;
