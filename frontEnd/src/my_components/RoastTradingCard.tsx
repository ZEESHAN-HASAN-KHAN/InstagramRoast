import { useState } from "react";
import type { CSSProperties } from "react";
import type { RarityId, RoastCardIdentity } from "@/lib/cardRarity";

// The card is always laid out at this exact pixel size and scaled to fit
// wherever it's shown. That way what someone sees on the page and what lands in
// the exported PNG are the same composition, not two designs kept in sync by
// hand.
export const CARD_W = 540;
export const CARD_H = 675;

export type CardProfile = {
  handle: string;
  displayName: string;
  avatarUrl: string;
  followers: number;
  posts: number;
};

type Skin = {
  /** Outer foil border. */
  frame: string;
  /** Card face behind the content. */
  surface: string;
  /** Hairline between frame and face — sells the "printed" edge. */
  innerEdge: string;
  text: string;
  muted: string;
  /** Rarity badge pill. */
  badgeBg: string;
  badgeText: string;
  /** Ring around the avatar. */
  avatarRing: string;
  /** Glow cast behind the whole card on the page. */
  glow: string;
  /** Extra decoration only the top tiers get. */
  effect?: "ember" | "shimmer" | "holo";
};

const SKINS: Record<RarityId, Skin> = {
  common: {
    frame: "linear-gradient(145deg,#d6d3d1,#fafaf9 45%,#a8a29e)",
    surface: "linear-gradient(165deg,#fffdf7 0%,#faf3e4 100%)",
    innerEdge: "rgba(28,25,23,0.85)",
    text: "#1c1917",
    muted: "rgba(28,25,23,0.55)",
    badgeBg: "#e7e5e4",
    badgeText: "#44403c",
    avatarRing: "linear-gradient(145deg,#a8a29e,#e7e5e4)",
    glow: "0 0 0 rgba(0,0,0,0)",
  },
  crispy: {
    frame: "linear-gradient(145deg,#7c2d12,#fb923c 45%,#c2410c)",
    surface: "linear-gradient(165deg,#1c1917 0%,#431407 55%,#7c2d12 100%)",
    innerEdge: "rgba(251,146,60,0.45)",
    text: "#fff7ed",
    muted: "rgba(255,247,237,0.6)",
    badgeBg: "linear-gradient(135deg,#ea580c,#f97316)",
    badgeText: "#fff7ed",
    avatarRing: "linear-gradient(145deg,#fb923c,#7c2d12)",
    glow: "0 0 60px rgba(249,115,22,0.35)",
    effect: "ember",
  },
  nuclear: {
    frame: "linear-gradient(145deg,#7f1d1d,#ef4444 28%,#fbbf24 52%,#dc2626 76%,#450a0a)",
    surface: "radial-gradient(ellipse at 50% 0%,#450a0a 0%,#1c0a0a 55%,#0c0a09 100%)",
    innerEdge: "rgba(239,68,68,0.55)",
    text: "#fee2e2",
    muted: "rgba(254,226,226,0.6)",
    badgeBg: "linear-gradient(135deg,#b91c1c,#ef4444)",
    badgeText: "#fff1f2",
    avatarRing: "linear-gradient(145deg,#fbbf24,#dc2626,#7f1d1d)",
    glow: "0 0 80px rgba(220,38,38,0.45)",
    effect: "ember",
  },
  golden: {
    // Multi-stop light/dark alternation is what reads as metal rather than
    // "yellow" — the eye needs the specular banding.
    frame:
      "linear-gradient(135deg,#7a5c12 0%,#d4af37 18%,#fdf3c0 32%,#d4af37 46%,#8a6d1f 58%,#fdf3c0 74%,#d4af37 88%,#7a5c12 100%)",
    surface: "linear-gradient(165deg,#1c1917 0%,#2b2317 50%,#14100b 100%)",
    innerEdge: "rgba(212,175,55,0.75)",
    text: "#fef3c7",
    muted: "rgba(254,243,199,0.6)",
    badgeBg: "linear-gradient(135deg,#b8860b,#f2d472)",
    badgeText: "#231a05",
    avatarRing: "linear-gradient(145deg,#fdf3c0,#d4af37,#8a6d1f)",
    glow: "0 0 90px rgba(212,175,55,0.5)",
    effect: "shimmer",
  },
  diamond: {
    frame:
      "conic-gradient(from 0deg,#ff0080,#ff8c00,#ffed00,#00ff8c,#00d4ff,#8c00ff,#ff0080)",
    surface: "linear-gradient(165deg,#0b1120 0%,#1e1b4b 50%,#08101f 100%)",
    innerEdge: "rgba(165,243,252,0.7)",
    text: "#e0f2fe",
    muted: "rgba(224,242,254,0.62)",
    badgeBg: "linear-gradient(135deg,#22d3ee,#a78bfa,#f472b6)",
    badgeText: "#0b1120",
    avatarRing: "conic-gradient(from 0deg,#22d3ee,#a78bfa,#f472b6,#facc15,#22d3ee)",
    glow: "0 0 110px rgba(139,92,246,0.55)",
    effect: "holo",
  },
};

// Backdrop for the 9:16 story export. A rare pull has to read as rare at a
// glance in someone's story, before the card itself is even legible.
export const STORY_BACKDROPS: Record<RarityId, string> = {
  common: "radial-gradient(ellipse at 50% 12%,#3f3b36 0%,#1c1917 45%,#0c0a09 100%)",
  crispy: "radial-gradient(ellipse at 50% 12%,#7c2d12 0%,#25150c 48%,#0c0a09 100%)",
  nuclear: "radial-gradient(ellipse at 50% 12%,#991b1b 0%,#2a0a0a 45%,#0c0a09 100%)",
  golden: "radial-gradient(ellipse at 50% 12%,#7a5c12 0%,#241c0c 45%,#0c0a09 100%)",
  diamond: "radial-gradient(ellipse at 50% 12%,#4c1d95 0%,#12163a 45%,#05070f 100%)",
};

function formatCount(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

// The exported PNG is drawn from a canvas, and a canvas is tainted by any image
// fetched without CORS headers. Requesting with `crossOrigin` is only half of
// it: a browser that already cached the plain (header-less) response will reuse
// it and taint the canvas anyway, so the request needs to be distinct.
export function corsAvatarUrl(url: string): string {
  // A data: URI carries its own bytes — there's no cache entry to bust, and a
  // query string appended to one corrupts the payload.
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return url.includes("?") ? `${url}&xo=1` : `${url}?xo=1`;
}

// Longer punchlines step down through these so the headline always fills its
// box without overflowing it.
function headlineSize(len: number) {
  if (len <= 55) return 40;
  if (len <= 90) return 34;
  if (len <= 130) return 29;
  return 25;
}

/**
 * The card's permanent number within its profile, and who owns it.
 *
 * Optional because the card renders before the lookup lands, and on the
 * archived-roast route where the number can't be resolved to this card. A
 * claimed mint is printed on the face rather than only in the page around it:
 * the exported image is what gets posted, and the credit travelling with the
 * screenshot is the entire reason someone buys the number.
 */
export type CardMint = {
  no: number;
  claimedBy: string | null;
};

export type RoastTradingCardProps = {
  identity: RoastCardIdentity;
  profile: CardProfile;
  mint?: CardMint | null;
  /** `export` freezes every animation and drops the outer shadow so nothing
   *  bleeds outside the captured bounds. */
  mode?: "live" | "export";
  /** On-screen width; internals stay at CARD_W and scale to match. */
  width?: number;
  className?: string;
};

export function RoastTradingCard({
  identity,
  profile,
  mint = null,
  mode = "live",
  width = CARD_W,
  className = "",
}: RoastTradingCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  // Pointer position in -1…1, driving both the tilt and where the foil
  // highlight sits. Centre until the pointer arrives.
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const { rarity, serial, headline } = identity;
  const skin = SKINS[rarity.id];
  const live = mode === "live";
  const scale = width / CARD_W;
  const anim = (cls: string) => (live ? cls : "");

  const initials = (profile.displayName || profile.handle || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const cardStyle: CSSProperties = {
    width: CARD_W,
    height: CARD_H,
    background: skin.frame,
    padding: 16,
    borderRadius: 32,
    boxShadow: live ? `12px 12px 0 0 hsl(0 0% 8%), ${skin.glow}` : "none",
    transform: live
      ? `rotateX(${(-tilt.y * 7).toFixed(2)}deg) rotateY(${(tilt.x * 7).toFixed(2)}deg)`
      : "none",
    transition: live ? "transform 180ms ease-out" : "none",
    transformStyle: "preserve-3d",
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  return (
    <div
      className={className}
      style={{ width, height: CARD_H * scale, perspective: live ? 1400 : undefined }}
      onPointerMove={
        live
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setTilt({
                x: ((e.clientX - r.left) / r.width) * 2 - 1,
                y: ((e.clientY - r.top) / r.height) * 2 - 1,
              });
            }
          : undefined
      }
      onPointerLeave={live ? () => setTilt({ x: 0, y: 0 }) : undefined}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div style={cardStyle}>
          {/* Diamond's frame is a conic gradient, so rotating it is what makes
              the holography move rather than just glow. */}
          {skin.effect === "holo" && live && (
            <div
              className="card-frame-spin"
              style={{
                position: "absolute",
                inset: "-40%",
                background: skin.frame,
                opacity: 0.9,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Card face */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: 22,
              background: skin.surface,
              border: `2px solid ${skin.innerEdge}`,
              padding: 26,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {/* Heat bloom behind the top tiers */}
            {(skin.effect === "ember" || skin.effect === "shimmer") && (
              <div
                className={anim("card-ember")}
                style={{
                  position: "absolute",
                  top: -120,
                  left: "50%",
                  marginLeft: -180,
                  width: 360,
                  height: 300,
                  borderRadius: "50%",
                  background:
                    rarity.id === "golden"
                      ? "radial-gradient(circle,rgba(212,175,55,0.4),transparent 70%)"
                      : "radial-gradient(circle,rgba(249,115,22,0.45),transparent 70%)",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Gold's specular sweep */}
            {skin.effect === "shimmer" && live && (
              <div
                className="card-shimmer"
                style={{
                  position: "absolute",
                  top: -60,
                  left: 0,
                  width: 120,
                  height: CARD_H + 120,
                  background:
                    "linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Prismatic wash, steered by the pointer so tilting shifts the colours */}
            {skin.effect === "holo" && (
              <div
                className={anim("card-holo")}
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "linear-gradient(115deg,transparent 25%,rgba(34,211,238,0.35) 38%,rgba(167,139,250,0.35) 48%,rgba(244,114,182,0.35) 58%,transparent 72%)",
                  backgroundSize: "220% 220%",
                  backgroundPosition: `${50 + tilt.x * 30}% ${50 + tilt.y * 30}%`,
                  mixBlendMode: "screen",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* ── Header: rarity + serial ── */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  background: skin.badgeBg,
                  color: skin.badgeText,
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "6px 14px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                {rarity.emoji} {rarity.name}
              </span>
              <span
                style={{
                  fontFamily: "JetBrains Mono, ui-monospace, monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: skin.muted,
                  letterSpacing: "0.08em",
                }}
              >
                {/* Two different numbers, deliberately both shown. The serial is
                    flavour derived from the roast text; the mint is the real,
                    sequential position in the profile's history — the one that
                    can be owned. Mint #1 is called out instead of numbered,
                    because "first" is the thing worth reading at a glance. */}
                {mint ? (mint.no === 1 ? "👑 FIRST MINT · " : `MINT #${mint.no} · `) : ""}
                NO. {serial}
              </span>
            </div>

            {/* ── Avatar ── */}
            <div style={{ position: "relative", marginTop: 22, textAlign: "center" }}>
              <div
                style={{
                  width: 124,
                  height: 124,
                  margin: "0 auto",
                  borderRadius: "50%",
                  background: skin.avatarRing,
                  padding: 4,
                  boxSizing: "border-box",
                }}
              >
                {avatarFailed || !profile.avatarUrl ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.35)",
                      color: skin.text,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "Playfair Display, Georgia, serif",
                      fontSize: 40,
                      fontWeight: 700,
                    }}
                  >
                    {initials}
                  </div>
                ) : (
                  <img
                    src={corsAvatarUrl(profile.avatarUrl)}
                    crossOrigin="anonymous"
                    alt=""
                    onError={() => setAvatarFailed(true)}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  marginTop: 12,
                  fontFamily: "JetBrains Mono, ui-monospace, monospace",
                  fontSize: 19,
                  fontWeight: 700,
                  color: skin.text,
                }}
              >
                @{profile.handle}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "Playfair Display, Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: skin.muted,
                }}
              >
                {profile.displayName}
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Pill skin={skin} label="followers" value={formatCount(profile.followers)} />
                <Pill skin={skin} label="posts" value={formatCount(profile.posts)} />
              </div>
            </div>

            {/* ── The punchline ── */}
            <div
              style={{
                position: "relative",
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 14,
                minHeight: 0,
              }}
            >
              <p
                style={{
                  fontFamily: "Playfair Display, Georgia, serif",
                  fontStyle: "italic",
                  fontWeight: 700,
                  fontSize: headlineSize(headline.length),
                  lineHeight: 1.18,
                  color: skin.text,
                  textAlign: "center",
                  margin: 0,
                  textWrap: "balance",
                }}
              >
                “{headline}”
              </p>
            </div>

            {/* ── Footer: watermark + pull rate ── */}
            <div
              style={{
                position: "relative",
                borderTop: `1px dashed ${skin.muted}`,
                paddingTop: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 900, color: skin.text, letterSpacing: "-0.01em" }}>
                instaroasts.com
              </span>
              <span style={{ fontWeight: 700, color: skin.muted }}>
                {rarity.pullRate}% pull rate
              </span>
            </div>

            {/* ── Owner credit ── the claimed name, on the face, in the export */}
            {mint?.claimedBy && (
              <div
                style={{
                  position: "relative",
                  marginTop: 8,
                  textAlign: "center",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 12,
                  fontWeight: 800,
                  color: skin.muted,
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {mint.no === 1 ? "first minted by" : "minted by"}{" "}
                <span style={{ color: skin.text }}>@{mint.claimedBy}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ skin, label, value }: { skin: Skin; label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "rgba(127,127,127,0.18)",
        border: `1px solid ${skin.muted}`,
        borderRadius: 999,
        padding: "3px 11px",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 12,
        color: skin.text,
      }}
    >
      <b style={{ fontWeight: 800 }}>{value}</b>
      <span style={{ color: skin.muted }}>{label}</span>
    </span>
  );
}
