/**
 * Generates frontEnd/public/og-image.png — the link preview for every page that
 * isn't a specific roast (home, leaderboard, terms…).
 *
 *   node scripts/makeSiteOgImage.js
 *
 * This is a one-off asset generator, not part of the request path. It lives
 * here because the fonts and the brand palette already do.
 *
 * The file it writes had been referenced by index.html since launch but never
 * actually existed, so every shared link fell back to a text-only preview.
 */
const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const W = 1200;
const H = 630;
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const OUT = path.join(__dirname, "..", "..", "frontEnd", "public", "og-image.png");

GlobalFonts.registerFromPath(path.join(FONT_DIR, "PlayfairDisplay-Italic.ttf"), "PfI");
GlobalFonts.registerFromPath(path.join(FONT_DIR, "Inter.ttf"), "In");

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

function weighted(text, x, y, color, weight = 0.05) {
  const size = parseInt(ctx.font, 10) || 24;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * weight;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

ctx.textAlign = "center";

ctx.font = "26px In";
ctx.letterSpacing = "8px";
weighted("INSTAROASTS", W / 2, 152, "rgba(255,247,237,0.72)");
ctx.letterSpacing = "0px";

ctx.font = "86px PfI";
weighted("Get roasted by an AI", W / 2, 286, "#fff7ed", 0.03);
ctx.font = "86px PfI";
weighted("with no manners.", W / 2, 382, "#fb923c", 0.03);

ctx.font = "30px In";
ctx.fillStyle = "rgba(255,247,237,0.72)";
ctx.fillText("Drop any Instagram handle. Pull a roast card. See how rare it is.", W / 2, 462);

// Pill footer echoing the card's rarity badge.
const label = "instaroasts.com";
ctx.font = "28px In";
const pillW = ctx.measureText(label).width + 64;
const pillX = W / 2 - pillW / 2;
ctx.fillStyle = "#f97316";
ctx.beginPath();
const r = 27;
ctx.moveTo(pillX + r, 520);
ctx.arcTo(pillX + pillW, 520, pillX + pillW, 574, r);
ctx.arcTo(pillX + pillW, 574, pillX, 574, r);
ctx.arcTo(pillX, 574, pillX, 520, r);
ctx.arcTo(pillX, 520, pillX + pillW, 520, r);
ctx.closePath();
ctx.fill();

ctx.textBaseline = "middle";
weighted(label, W / 2, 548, "#1c1917", 0.04);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, canvas.toBuffer("image/png"));
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${W}x${H})`);
