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

// Rewrites the whole preview block in one pass. Both the per-roast route and
// the static pages below go through this, so a tag added to one is never
// silently missing from the other.
function applyMeta(html, { title, description, image, imageAlt, url, type }) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = setMeta(out, "description", description);
  out = setMeta(out, "og:title", title);
  out = setMeta(out, "og:description", description);
  out = setMeta(out, "og:image", image);
  out = setMeta(out, "og:image:alt", imageAlt ?? title);
  out = setMeta(out, "og:url", url);
  if (type) out = setMeta(out, "og:type", type);
  out = setMeta(out, "twitter:title", title);
  out = setMeta(out, "twitter:description", description);
  out = setMeta(out, "twitter:image", image);
  out = setMeta(out, "twitter:url", url);
  out = out.replace(
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(url)}" />`
  );
  return out;
}

// Per-page previews for the routes that aren't an Instagram handle. Without
// this every one of them unfurled as the homepage: react-helmet sets these tags
// in the browser and no link-preview crawler runs JavaScript, so WhatsApp,
// Facebook, Twitter and Slack all saw the shell's home copy no matter which
// page was shared. Keep in sync with the <Route> table in src/App.tsx.
//
// The home shell already carries its own tags, so "/" is deliberately absent.
const PAGE_META = {
  "/leaderboard": {
    title: "Hall of Shame 🏆 — InstaRoasts Leaderboard",
    description:
      "Today's most roasted and most savage Instagram profiles — see who got cooked hardest in the last 24 hours, worldwide and near you.",
    image: `${SITE}/og-leaderboard.png`,
    imageAlt: "InstaRoasts leaderboard — who got cooked hardest today",
  },
  "/compatibilityRoast": {
    title: "Couple Roast 💔 — InstaRoasts",
    description:
      "Drop two Instagram handles and let the AI judge whether you two make sense. Brutally.",
  },
  "/terms": {
    title: "Terms — InstaRoasts",
    description: "The terms of service for InstaRoasts.",
  },
  "/privacy": {
    title: "Privacy — InstaRoasts",
    description: "What InstaRoasts collects, what it doesn't, and how to get it deleted.",
  },
  "/refund-policy": {
    title: "Refund Policy — InstaRoasts",
    description: "When an InstaRoasts credit purchase can be refunded, and how to ask.",
  },
};

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

// Static files are matched first so that whether a path is an asset is decided
// by whether the file actually exists, not by guessing from its shape. A
// heuristic here is actively dangerous: Instagram handles routinely contain
// dots (virat.kohli, john.doe), and any "looks like it has an extension" rule
// silently strips the card preview from a large slice of real profiles.
app.use(
  express.static(DIST, {
    // The shell must never be cached alongside the hashed assets — it carries
    // the per-roast tags injected below.
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.get("/:username", async (req, res, next) => {
  const { username } = req.params;
  if (RESERVED.has(username) || !HANDLE.test(username)) return next();

  const language = typeof req.query.language === "string" ? req.query.language : undefined;
  const meta = await fetchMeta(username, language);

  // No roast yet (or the API is unreachable): serve the shell untouched so the
  // page still works and the generic preview still shows.
  if (!meta) return res.type("html").send(template);

  const pageUrl = `${SITE}/${username}${language ? `?language=${encodeURIComponent(language)}` : ""}`;
  // The shell ships 1200x630 for the generic image and the renderer emits the
  // same dimensions, so the width/height tags stay correct as-is.
  const html = applyMeta(template, {
    title: meta.title,
    description: meta.description,
    image: meta.image,
    imageAlt: meta.title,
    url: pageUrl,
    type: "article",
  });

  res.set("Cache-Control", "public, max-age=300");
  return res.type("html").send(html);
});

// SPA fallback for client-side routes. Written as middleware rather than
// app.get("*") because Express 5 rejects a bare "*" path pattern.
//
// A request that looks like a file and got this far does not exist on disk, so
// it 404s instead of being handed the HTML shell. Answering 200 text/html to a
// missing .png is how og-image.png stayed broken without anyone noticing — the
// crawler fetched it, got a page, and silently showed no image. Handles reach
// the route above and never arrive here, so this cannot swallow a profile.
app.use((req, res) => {
  if (/\.[a-z0-9]+$/i.test(req.path)) return res.status(404).type("txt").send("Not found");

  // Trailing slashes and casing both reach here as distinct paths, and a shared
  // "/leaderboard/" that missed the table would silently unfurl as the homepage
  // again — the exact bug this table exists to kill.
  const key = req.path.replace(/\/+$/, "") || "/";
  const page = PAGE_META[key];
  if (page) {
    const html = applyMeta(template, {
      ...page,
      image: page.image ?? `${SITE}/og-image.png`,
      url: `${SITE}${key}`,
    });
    res.set("Cache-Control", "public, max-age=300");
    return res.type("html").send(html);
  }

  return res.type("html").send(template);
});

app.listen(PORT, () => console.log(`frontend listening on ${PORT}`));
