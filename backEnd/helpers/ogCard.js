const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const logger = require("./logger");

// Link-preview render of the roast card. This is NOT the collectible card the
// browser draws — that one is 4:5 and full of CSS the crawler will never run.
// This is a 1.91:1 landscape restatement of it in the same visual language,
// which is the aspect ratio WhatsApp, Twitter and Facebook actually crop to.
//
// Rendered with a canvas rather than headless Chrome so it costs milliseconds
// and no extra service. Two consequences to keep in mind when editing:
//   - Fonts must be files we ship; the Alpine runtime has none of its own.
//   - No emoji. There is no emoji font in the container, so any emoji would
//     rasterize as blank boxes. Tier names carry the meaning instead.

const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
let fontsReady = false;

// Roasts are generated in whatever ALLOWED_LANGUAGE permits, and Playfair/Inter
// cover Latin only. The canvas does NOT do per-glyph fallback — a font stack
// like "Playfair, NotoDevanagari" silently renders the first family and emits
// tofu boxes — so the script has to be detected and the family chosen up front.
//
// Each of these Noto faces also carries Latin, which is what makes mixed text
// (a Hindi roast quoting an English word, or hinglish) come out whole.
//
// To add a script: drop the TTF in assets/fonts and add a row. Korean/CJK is
// deliberately absent — Noto Sans KR is 10 MB, and until someone decides that
// is worth carrying, those roasts take the headline-less layout below rather
// than rendering a wall of empty boxes.
const SCRIPT_FONTS = [
  { re: /[ऀ-ॿ]/, family: "NotoDevanagariOG", file: "NotoSansDevanagari.ttf" },
  { re: /[ঀ-৿]/, family: "NotoBengaliOG", file: "NotoSansBengali.ttf" },
  { re: /[؀-ۿݐ-ݿﭐ-﷿]/, family: "NotoArabicOG", file: "NotoSansArabic.ttf" },
];

// Anything here has no bundled face, so its headline is dropped instead of
// drawn as boxes.
const UNRENDERABLE = /[가-힯ᄀ-ᇿ぀-ヿ一-鿿]/;

const RTL = /[؀-ۿݐ-ݿﭐ-﷿]/;

function ensureFonts() {
  if (fontsReady) return;
  GlobalFonts.registerFromPath(path.join(FONT_DIR, "PlayfairDisplay.ttf"), "PlayfairOG");
  GlobalFonts.registerFromPath(
    path.join(FONT_DIR, "PlayfairDisplay-Italic.ttf"),
    "PlayfairOGItalic"
  );
  GlobalFonts.registerFromPath(path.join(FONT_DIR, "Inter.ttf"), "InterOG");
  for (const s of SCRIPT_FONTS) {
    GlobalFonts.registerFromPath(path.join(FONT_DIR, s.file), s.family);
  }
  fontsReady = true;
}

/** @returns {string|null} family to set the headline in, or null if unrenderable. */
function headlineFont(text) {
  if (UNRENDERABLE.test(text)) return null;
  const match = SCRIPT_FONTS.find((s) => s.re.test(text));
  return match ? match.family : "PlayfairOGItalic";
}

// The variable Inter/Playfair files expose weight axes the canvas does not
// apply — "bold 30px" measures identical to "30px". Stroking the glyph outline
// at a hair of the type size thickens it convincingly at display sizes, which
// is all this image uses text for.
function drawWeighted(ctx, text, x, y, color, weight = 0.055) {
  const size = parseInt(ctx.font, 10) || 24;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * weight;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

const W = 1200;
const H = 630;

// Mirrors the SKINS table in frontEnd/src/my_components/RoastTradingCard.tsx.
// Kept as flat stops because a canvas gradient takes colour stops, not CSS.
const SKINS = {
  common: {
    bg: ["#faf5ea", "#e7e0cf"],
    text: "#1c1917",
    muted: "rgba(28,25,23,0.62)",
    badgeBg: "#1c1917",
    badgeText: "#faf5ea",
    ring: ["#a8a29e", "#e7e5e4"],
    rule: "rgba(28,25,23,0.25)",
  },
  crispy: {
    bg: ["#2b1408", "#7c2d12"],
    text: "#fff7ed",
    muted: "rgba(255,247,237,0.7)",
    badgeBg: "#f97316",
    badgeText: "#1c1917",
    ring: ["#fb923c", "#7c2d12"],
    rule: "rgba(251,146,60,0.4)",
  },
  nuclear: {
    bg: ["#2a0a0a", "#7f1d1d"],
    text: "#fee2e2",
    muted: "rgba(254,226,226,0.72)",
    badgeBg: "#ef4444",
    badgeText: "#1c0a0a",
    ring: ["#fbbf24", "#dc2626"],
    rule: "rgba(239,68,68,0.45)",
  },
  golden: {
    bg: ["#16120a", "#4a3a12"],
    text: "#fef3c7",
    muted: "rgba(254,243,199,0.72)",
    badgeBg: "#d4af37",
    badgeText: "#231a05",
    ring: ["#fdf3c0", "#8a6d1f"],
    rule: "rgba(212,175,55,0.5)",
  },
  diamond: {
    bg: ["#0b1120", "#3b1d6b"],
    text: "#e0f2fe",
    muted: "rgba(224,242,254,0.75)",
    badgeBg: "#a78bfa",
    badgeText: "#0b1120",
    ring: ["#22d3ee", "#f472b6"],
    rule: "rgba(165,243,252,0.45)",
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Greedy wrap against real glyph metrics, then shrink until it fits the box.
// Returns the chosen size and the laid-out lines.
function fitText(ctx, text, { maxWidth, maxLines, start, min, font }) {
  for (let size = start; size >= min; size -= 2) {
    ctx.font = `${size}px ${font}`;
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) return { size, lines };
  }
  // Nothing fit: hard-truncate at the smallest size rather than overflow.
  ctx.font = `${min}px ${font}`;
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s.,;:]+$/, "") + "…";
  }
  return { size: min, lines };
}

async function fetchAvatar(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`avatar fetch ${res.status}`);
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    // A missing picture must not cost us the whole preview — the initials
    // fallback below still produces a shareable image.
    logger.warning("[og] avatar unavailable, falling back to initials", {
      error: err.message,
    });
    return null;
  }
}

// Initials are drawn in Playfair, so a display name in a script Playfair lacks
// would come out as boxes. Instagram handles are ASCII by definition, which
// makes the handle a safe second source.
function initialsOf(displayName, handle) {
  const fromName = (displayName || "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] || "").toUpperCase())
    .join("");
  if (fromName && /^[\x20-\x7E]+$/.test(fromName)) return fromName;
  return (handle || "?").slice(0, 2).toUpperCase();
}

/**
 * Draws the link-preview image.
 *
 * @returns {Promise<Buffer>} JPEG bytes. JPEG rather than PNG because WhatsApp
 *   silently drops previews over roughly a megabyte, and this art is all smooth
 *   gradients, which JPEG handles at a fraction of PNG's size.
 */
async function renderOgCard({ identity, profile }) {
  ensureFonts();
  const skin = SKINS[identity.rarity.id] || SKINS.common;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, skin.bg[0]);
  bg.addColorStop(1, skin.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Warm bloom behind the portrait, echoing the card's heat glow.
  const bloom = ctx.createRadialGradient(300, 250, 20, 300, 250, 380);
  bloom.addColorStop(0, "rgba(255,255,255,0.16)");
  bloom.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, 700, H);

  // ── Portrait ──
  const cx = 300;
  const cy = 268;
  const r = 118;

  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, skin.ring[0]);
  ring.addColorStop(1, skin.ring[1]);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
  ctx.fill();

  const avatar = await fetchAvatar(profile.avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    // Cover-fit: fill the circle without distorting a non-square source.
    const scale = Math.max((r * 2) / avatar.width, (r * 2) / avatar.height);
    const dw = avatar.width * scale;
    const dh = avatar.height * scale;
    ctx.drawImage(avatar, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = skin.text;
    ctx.font = "76px PlayfairOG";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialsOf(profile.displayName, profile.handle), cx, cy + 4);
  }
  ctx.restore();

  // ── Handle ──
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const handleFit = fitText(ctx, `@${profile.handle}`, {
    maxWidth: 440,
    maxLines: 1,
    start: 40,
    min: 22,
    font: "InterOG",
  });
  ctx.font = `${handleFit.size}px InterOG`;
  drawWeighted(ctx, handleFit.lines[0], cx, cy + r + 66, skin.text);

  // ── Rarity badge ──
  const badgeLabel = identity.rarity.name.toUpperCase();
  ctx.font = "22px InterOG";
  const badgeW = ctx.measureText(badgeLabel).width + 56;
  const badgeH = 48;
  const badgeY = cy + r + 92;
  ctx.fillStyle = skin.badgeBg;
  roundRect(ctx, cx - badgeW / 2, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.textBaseline = "middle";
  drawWeighted(ctx, badgeLabel, cx, badgeY + badgeH / 2 + 1, skin.badgeText, 0.045);

  // ── Punchline ──
  const textX = 600;
  const textW = 530;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const font = headlineFont(identity.headline || "");
  if (font && identity.headline) {
    // Right-to-left scripts have to be anchored on the right edge as well as
    // shaped right-to-left; setting direction alone leaves each line starting
    // at the left margin and running off the canvas.
    const rtl = RTL.test(identity.headline);
    if (rtl) {
      ctx.direction = "rtl";
      ctx.textAlign = "right";
    }
    // Latin gets typographic quotes; other scripts read cleaner without them.
    const quoted = font === "PlayfairOGItalic" ? `“${identity.headline}”` : identity.headline;
    const head = fitText(ctx, quoted, {
      maxWidth: textW,
      maxLines: 7,
      start: font === "PlayfairOGItalic" ? 52 : 44,
      min: 24,
      font,
    });
    ctx.font = `${head.size}px ${font}`;
    ctx.fillStyle = skin.text;
    const lineHeight = head.size * 1.28;
    let ty = 300 - (head.lines.length * lineHeight) / 2 + head.size;
    for (const line of head.lines) {
      ctx.fillText(line, rtl ? textX + textW : textX, ty);
      ty += lineHeight;
    }
    ctx.direction = "inherit";
  } else {
    // No face for this script. Say something true in a script we can draw
    // rather than emit a block of empty boxes.
    ctx.font = "46px PlayfairOGItalic";
    ctx.fillStyle = skin.text;
    ctx.fillText("They got roasted.", textX, 268);
    ctx.font = "28px InterOG";
    ctx.fillStyle = skin.muted;
    ctx.fillText("Open it to read the damage.", textX, 320);
  }

  // ── Footer ──
  ctx.strokeStyle = skin.rule;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(textX, 540);
  ctx.lineTo(W - 70, 540);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "left";
  ctx.font = "26px InterOG";
  drawWeighted(ctx, "instaroasts.com", textX, 582, skin.text);

  ctx.textAlign = "right";
  ctx.font = "22px InterOG";
  ctx.fillStyle = skin.muted;
  ctx.fillText(`${identity.rarity.pullRate}% pull rate`, W - 70, 582);

  return canvas.encode("jpeg", 88);
}

module.exports = { renderOgCard, W, H };
