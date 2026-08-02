// Serves the built SPA, and rewrites the <head> of /:username so link previews
// show the actual roast card.
//
// Why this exists: react-helmet sets the per-roast og: tags in the browser, and
// no link-preview crawler runs JavaScript. WhatsApp, Facebook, Twitter and
// Slack all read the HTML as served, so before this every shared roast unfurled
// with the same generic house image no matter whose roast it was.
//
// The tags are injected for every visitor, not just crawlers. Sniffing the
// user-agent to serve bots different HTML is cloaking, and search engines
// penalise it; injecting for everyone is simpler and React re-applies the same
// values on hydrate anyway.

// ESM, because package.json declares "type": "module".
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 5173;
const DIST = path.join(__dirname, "dist");
const API = (process.env.API_ORIGIN || "http://localhost:8080").replace(/\/$/, "");
const SITE = (process.env.SITE_ORIGIN || "https://instaroasts.com").replace(/\/$/, "");

// How long to wait on the API before giving up and serving the untouched
// shell. A crawler that times out shows no preview at all, so failing fast to
// the generic one is strictly better than hanging.
const META_TIMEOUT_MS = Number(process.env.META_TIMEOUT_MS) || 2500;

const template = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

// Everything the SPA routes to that is a page, not an Instagram handle. Kept in
// sync with the <Route> table in src/App.tsx.
const RESERVED = new Set([
  "compatibilityRoast",
  "leaderboard",
  "terms",
  "privacy",
  "refund-policy",
]);

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Replaces the content of the specific og:/twitter: tags we control, leaving
// every other tag in the shell untouched.
function setMeta(html, selector, value) {
  const pattern = new RegExp(
    `(<meta\\s+(?:property|name)=["']${selector}["']\\s+content=["'])[^"']*(["'])`,
    "i"
  );
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
}

async function fetchMeta(username, language) {
  const url = new URL(`${API}/api/v1/og-meta/${encodeURIComponent(username)}`);
  if (language) url.searchParams.set("language", language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

app.get("/:username", async (req, res, next) => {
  const { username } = req.params;
  if (RESERVED.has(username) || !HANDLE.test(username)) return next();
  // Anything with a file extension is an asset, not a profile.
  if (username.includes(".") && /\.[a-z0-9]{2,5}$/i.test(username)) return next();

  const language = typeof req.query.language === "string" ? req.query.language : undefined;
  const meta = await fetchMeta(username, language);

  // No roast yet (or the API is unreachable): serve the shell untouched so the
  // page still works and the generic preview still shows.
  if (!meta) return res.type("html").send(template);

  const pageUrl = `${SITE}/${username}${language ? `?language=${encodeURIComponent(language)}` : ""}`;
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = setMeta(html, "description", meta.description);
  html = setMeta(html, "og:title", meta.title);
  html = setMeta(html, "og:description", meta.description);
  html = setMeta(html, "og:image", meta.image);
  // The shell ships 1200x630 for the generic image and the renderer emits the
  // same dimensions, so width/height stay correct; only the alt text needs to
  // stop describing the house image.
  html = setMeta(html, "og:image:alt", meta.title);
  html = setMeta(html, "og:url", pageUrl);
  html = setMeta(html, "og:type", "article");
  html = setMeta(html, "twitter:title", meta.title);
  html = setMeta(html, "twitter:description", meta.description);
  html = setMeta(html, "twitter:image", meta.image);
  html = setMeta(html, "twitter:url", pageUrl);
  html = html.replace(
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`
  );

  res.set("Cache-Control", "public, max-age=300");
  return res.type("html").send(html);
});

app.use(
  express.static(DIST, {
    // The shell must never be cached with the hashed assets — it carries the
    // per-roast tags above.
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

// SPA fallback for client-side routes. Written as middleware rather than
// app.get("*") because Express 5 rejects a bare "*" path pattern.
app.use((_req, res) => res.type("html").send(template));

app.listen(PORT, () => console.log(`frontend listening on ${PORT}`));
