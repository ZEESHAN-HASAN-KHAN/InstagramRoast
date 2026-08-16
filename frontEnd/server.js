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
function applyMeta(html, { title, description, image, imageAlt, url, type, robots }) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = setMeta(out, "description", description);
  if (robots) out = setMeta(out, "robots", robots);
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
// Each entry also carries its sitemap hints, so a page added here shows up in
// /sitemap-static.xml automatically instead of having to be remembered twice.
const PAGE_META = {
  "/leaderboard": {
    title: "Hall of Shame 🏆 — InstaRoasts Leaderboard",
    description:
      "The most roasted, most savage and rarest-card Instagram profiles — today's rolling 24h boards and the all-time hall of shame, worldwide and near you.",
    image: `${SITE}/og-leaderboard.png`,
    imageAlt: "InstaRoasts leaderboard — who got cooked hardest today",
    sitemap: { changefreq: "daily", priority: "0.9" },
  },
  "/compatibilityRoast": {
    title: "Couple Roast 💔 — InstaRoasts",
    description:
      "Drop two Instagram handles and let the AI judge whether you two make sense. Brutally.",
    sitemap: { changefreq: "weekly", priority: "0.8" },
  },
  "/terms": {
    title: "Terms — InstaRoasts",
    description: "The terms of service for InstaRoasts.",
    sitemap: { changefreq: "yearly", priority: "0.3" },
  },
  "/privacy": {
    title: "Privacy — InstaRoasts",
    description: "What InstaRoasts collects, what it doesn't, and how to get it deleted.",
    sitemap: { changefreq: "yearly", priority: "0.3" },
  },
  "/refund-policy": {
    title: "Refund Policy — InstaRoasts",
    description: "When an InstaRoasts credit purchase can be refunded, and how to ask.",
    sitemap: { changefreq: "yearly", priority: "0.3" },
  },
};

// Distinct from null on purpose. Null means "we don't know" (API down, timed
// out), and a page we can't classify must keep whatever robots tag the shell
// ships — guessing `noindex` during an outage would de-index every roast page
// we have. NO_ROAST means the API answered and there is genuinely nothing here,
// which is a page that should never enter the index.
const NO_ROAST = Symbol("no-roast");

async function fetchMeta(username, language) {
  const url = new URL(`${API}/api/v1/og-meta/${encodeURIComponent(username)}`);
  if (language) url.searchParams.set("language", language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) return NO_ROAST;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Sitemap
//
// Split across two owners, because the two halves are different kinds of thing.
// The static pages are the route table above, which lives in this file. The
// roast pages are a database query that grows every time an eligible profile
// gets roasted, so they come from the API. /sitemap.xml is the index tying them
// together, which is also what keeps the whole thing under the spec's 50,000
// URLs-per-file cap as the roast half grows.
//
// Registered ahead of express.static so a stale public/sitemap.xml left in a
// build can never shadow the live one.

const SITEMAP_TIMEOUT_MS = Number(process.env.SITEMAP_TIMEOUT_MS) || 5000;

// Real deploy date rather than "now": a <lastmod> that moves every time the
// file is fetched is the fastest way to teach a crawler to stop believing it.
const BUILD_DATE = (() => {
  try {
    return fs.statSync(path.join(DIST, "index.html")).mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
})();

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderUrlset(entries) {
  const body = entries
    .map(
      (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

// Shard count and freshness for the roast half. On failure it claims a single
// shard: that shard's own request will fail too and Google retries the sitemap,
// which is a better outcome than serving an index that omits every roast page
// and inviting a mass de-indexing.
async function fetchSitemapManifest() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/api/v1/sitemap/manifest`, { signal: controller.signal });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[sitemap] manifest unavailable:", err.message);
    return { shards: 1, lastmod: null };
  } finally {
    clearTimeout(timer);
  }
}

app.get("/sitemap.xml", async (req, res) => {
  const { shards, lastmod } = await fetchSitemapManifest();

  const children = [
    { loc: `${SITE}/sitemap-static.xml`, lastmod: BUILD_DATE },
    ...Array.from({ length: shards }, (_, i) => ({
      loc: `${SITE}/sitemap-roasts-${i + 1}.xml`,
      lastmod: lastmod || BUILD_DATE,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children
  .map(
    (c) => `  <sitemap>
    <loc>${escapeXml(c.loc)}</loc>
    <lastmod>${c.lastmod}</lastmod>
  </sitemap>`
  )
  .join("\n")}
</sitemapindex>
`;

  res.set("Cache-Control", "public, max-age=3600");
  return res.type("application/xml").send(xml);
});

app.get("/sitemap-static.xml", (req, res) => {
  const entries = [
    { loc: `${SITE}/`, lastmod: BUILD_DATE, changefreq: "weekly", priority: "1.0" },
    ...Object.entries(PAGE_META).map(([route, page]) => ({
      loc: `${SITE}${route}`,
      lastmod: BUILD_DATE,
      changefreq: page.sitemap?.changefreq ?? "monthly",
      priority: page.sitemap?.priority ?? "0.5",
    })),
  ];

  res.set("Cache-Control", "public, max-age=3600");
  return res.type("application/xml").send(renderUrlset(entries));
});

// Streamed straight through from the API. It has to be served from this origin
// — a sitemap may only list URLs under the host that serves it, so pointing the
// index at the API's own domain would make every entry in it invalid.
app.get("/sitemap-roasts-:shard.xml", async (req, res) => {
  const shard = Number(req.params.shard);
  if (!Number.isInteger(shard) || shard < 1) return res.status(404).type("txt").send("Not found");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${API}/api/v1/sitemap/roasts/${shard}.xml`, {
      signal: controller.signal,
    });
    if (!upstream.ok) return res.status(upstream.status).type("txt").send("Unavailable");

    res.set("Cache-Control", "public, max-age=21600");
    return res.type("application/xml").send(await upstream.text());
  } catch (err) {
    console.warn("[sitemap] shard fetch failed:", err.message);
    return res.status(503).type("txt").send("Unavailable");
  } finally {
    clearTimeout(timer);
  }
});

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

  // No roast here yet: the page still works and still shows the generic
  // preview, but there is nothing on it worth indexing — an empty handle page
  // in search results is a soft 404 against the whole domain.
  if (meta === NO_ROAST) {
    return res
      .type("html")
      .send(setMeta(template, "robots", "noindex, follow"));
  }

  // API unreachable: serve the shell untouched, robots tag included. See the
  // note on NO_ROAST above.
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
    // The API decides eligibility, so the tag on the page and the contents of
    // the sitemap are answers to the same question. `follow` either way: a
    // small account's roast page shouldn't be in the index, but the links out
    // of it are still worth crawling.
    robots: meta.indexable ? "index, follow" : "noindex, follow",
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

app.listen(PORT, () => {
  // Every failure caused by a missing API_ORIGIN is silent by design — the
  // preview falls back to the generic card, the sitemap falls back to one empty
  // shard, and the page still renders. That is correct behaviour for a
  // momentary outage and terrible for a misconfiguration, which looks identical
  // and lasts until someone notices the previews are wrong. Say it once at boot.
  if (!process.env.API_ORIGIN) {
    console.warn(
      `[config] API_ORIGIN is unset, falling back to ${API}. Link previews and the roast sitemap will not work unless the API is really there.`
    );
  }
  console.log(`frontend listening on ${PORT}`);
});
