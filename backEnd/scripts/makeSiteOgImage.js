/**
 * Generates the static link-preview images for every page that isn't a specific
 * roast:
 *
 *   frontEnd/public/og-image.png        — home, and the fallback for everything
 *   frontEnd/public/og-leaderboard.png  — /leaderboard
 *
 *   node scripts/makeSiteOgImage.js
 *
 * This is a one-off asset generator, not part of the request path. It lives
 * here because the fonts and the brand palette already do.
 *
 * The files it writes had been referenced by index.html since launch but never
 * actually existed, so every shared link fell back to a text-only preview.
 *
 * No emoji anywhere in these: the registered fonts carry no colour-emoji table,
 * so a 🏆 renders as a tofu box in the one image people see before they click.
 */
const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const W = 1200;
const H = 630;
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const OUT_DIR = path.join(__dirname, "..", "..", "frontEnd", "public");

GlobalFonts.registerFromPath(path.join(FONT_DIR, "PlayfairDisplay-Italic.ttf"), "PfI");
GlobalFonts.registerFromPath(path.join(FONT_DIR, "Inter.ttf"), "In");

const CREAM = "#fff7ed";
const CREAM_DIM = "rgba(255,247,237,0.72)";
const EMBER = "#fb923c";
const ORANGE = "#f97316";
const INK = "#1c1917";

function newCanvas() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Same warm ember the roast page opens with.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c1917");
  bg.addColorStop(0.55, "#3b1206");
  bg.addColorStop(1, "#0c0a09");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const bloom = ctx.createRadialGradient(W / 2, 250, 30, W / 2, 250, 520);
  bloom.addColorStop(0, "rgba(249,115,22,0.30)");
  bloom.addColorStop(1, "rgba(249,115,22,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  return { canvas, ctx };
}

// Playfair at these sizes renders thin against the gradient; stroking the glyph
// in its own colour thickens it just enough to hold up at thumbnail scale.
function weighted(ctx, text, x, y, color, weight = 0.05) {
  const size = parseInt(ctx.font, 10) || 24;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * weight;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function kicker(ctx, text, y) {
  ctx.font = "26px In";
  ctx.letterSpacing = "8px";
  weighted(ctx, text, W / 2, y, CREAM_DIM);
  ctx.letterSpacing = "0px";
}

// Pill footer echoing the card's rarity badge. Doubles as the only place the
// URL appears, so it carries the path too on non-home images.
function urlPill(ctx, label, top, height = 54) {
  ctx.font = "28px In";
  const pillW = ctx.measureText(label).width + 64;
  const pillX = W / 2 - pillW / 2;
  ctx.fillStyle = ORANGE;
  roundRect(ctx, pillX, top, pillW, height, height / 2);
  ctx.fill();

  ctx.textBaseline = "middle";
  weighted(ctx, label, W / 2, top + height / 2, INK, 0.04);
  ctx.textBaseline = "alphabetic";
}

function write(canvas, name) {
  const out = path.join(OUT_DIR, name);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${W}x${H})`);
}

/* --- home ---------------------------------------------------------------- */

function renderHome() {
  const { canvas, ctx } = newCanvas();

  kicker(ctx, "INSTAROASTS", 152);

  ctx.font = "86px PfI";
  weighted(ctx, "Get roasted by an AI", W / 2, 286, CREAM, 0.03);
  ctx.font = "86px PfI";
  weighted(ctx, "with no manners.", W / 2, 382, EMBER, 0.03);

  ctx.font = "30px In";
  ctx.fillStyle = CREAM_DIM;
  ctx.fillText("Drop any Instagram handle. Pull a roast card. See how rare it is.", W / 2, 462);

  urlPill(ctx, "instaroasts.com", 520);

  write(canvas, "og-image.png");
}

/* --- /leaderboard -------------------------------------------------------- */

// Three plaques at podium heights off a shared baseline. It reads as a ranking
// at thumbnail size without needing a single legible word, which matters
// because WhatsApp renders this at about a third of its real width.
function podium(ctx, baseline) {
  const plaques = [
    { label: "02", x: 396, h: 56, primary: false },
    { label: "01", x: 540, h: 78, primary: true },
    { label: "03", x: 684, h: 46, primary: false },
  ];

  for (const { label, x, h, primary } of plaques) {
    const w = 120;
    const top = baseline - h;
    roundRect(ctx, x, top, w, h, 16);
    ctx.fillStyle = primary ? ORANGE : "rgba(255,247,237,0.10)";
    ctx.fill();
    ctx.strokeStyle = primary ? ORANGE : "rgba(255,247,237,0.32)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `${primary ? 40 : 32}px In`;
    ctx.textBaseline = "middle";
    weighted(ctx, label, x + w / 2, top + h / 2 + 1, primary ? INK : CREAM_DIM, 0.03);
    ctx.textBaseline = "alphabetic";
  }
}

function renderLeaderboard() {
  const { canvas, ctx } = newCanvas();

  kicker(ctx, "INSTAROASTS  ·  HALL OF SHAME", 108);

  ctx.font = "84px PfI";
  weighted(ctx, "Who got cooked", W / 2, 212, CREAM, 0.03);
  ctx.font = "84px PfI";
  weighted(ctx, "hardest today.", W / 2, 302, EMBER, 0.03);

  ctx.font = "28px In";
  ctx.fillStyle = CREAM_DIM;
  ctx.fillText("Most roasted and most savage profiles. Rolling 24-hour window.", W / 2, 364);

  podium(ctx, 500);

  urlPill(ctx, "instaroasts.com/leaderboard", 540);

  write(canvas, "og-leaderboard.png");
}

renderHome();
renderLeaderboard();
