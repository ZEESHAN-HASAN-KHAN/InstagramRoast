import { useRef, useState } from "react";
import { corsAvatarUrl } from "./RoastTradingCard";
import { renderCardBlob, shareOrDownload } from "@/lib/cardExport";
import { track } from "@/lib/analytics";
import type { FeedScope, LeaderboardEntry, LeaderboardSection } from "@/lib/api";

// The daily Instagram post. Same trick as the roast card: the board is laid out
// at half size in real DOM and rasterized at 2x, so this exports at 1080x1350 —
// Instagram's 4:5 portrait slot, the largest a feed post can occupy.
export const POSTER_W = 540;
export const POSTER_H = 675;

const INK = "#1c1917";
const CREAM = "#fff7ed";
const ORANGE = "#f97316";
const YELLOW = "#fde047";
const SANS = "Inter, system-ui, sans-serif";
const SERIF = "Playfair Display, Georgia, serif";

// How many make the cut. Five is what fits at a size that still reads on a
// phone scrolling past at speed; more and the board becomes a spreadsheet.
const POSTER_LIMIT = 5;

// The poster is a fixed box, so nothing inside it is allowed to size itself
// freely — the list gets whatever the header and footer leave over, and the
// rows divide that. These are the only vertical numbers that matter.
const PAD = 30;
const CHAMPION_H = 116;
const ROW_GAP = 10;
const MAX_ROW_H = 58;
/** Ledger padding + column header + its rule. */
const LEDGER_CHROME_H = 34;

/**
 * Two posts come off the same frame. `roasted` counts who got looked at most;
 * `savage` ranks the crowd's burn ratings — the site draws that board inverted,
 * and so does this, which also makes the pair read as a set in a carousel.
 */
export type PosterBoard = "roasted" | "savage";

type Theme = {
  bg: string;
  grid: string;
  text: string;
  border: string;
  champBg: string;
  champShadow: string;
  champInk: string;
  champMuted: string;
  champRule: string;
  chipBg: string;
  chipText: string;
  ledgerBg: string;
  ledgerShadow: string;
  ledgerMuted: string;
  divider: string;
  dashed: string;
  footerBg: string;
  footerText: string;
  footerMuted: string;
};

const THEMES: Record<PosterBoard, Theme> = {
  roasted: {
    bg: CREAM,
    grid: "rgba(28,25,23,0.05)",
    text: INK,
    border: INK,
    champBg: ORANGE,
    champShadow: INK,
    champInk: INK,
    champMuted: "rgba(28,25,23,0.72)",
    champRule: "rgba(28,25,23,0.25)",
    chipBg: INK,
    chipText: ORANGE,
    ledgerBg: "#ffffff",
    ledgerShadow: INK,
    ledgerMuted: "rgba(28,25,23,0.4)",
    divider: "rgba(28,25,23,0.16)",
    dashed: "rgba(28,25,23,0.28)",
    footerBg: INK,
    footerText: CREAM,
    footerMuted: "rgba(255,247,237,0.55)",
  },
  savage: {
    bg: "#14110f",
    grid: "rgba(255,247,237,0.05)",
    text: CREAM,
    border: CREAM,
    champBg: "#dc2626",
    // A black drop shadow vanishes against a near-black ground, so the savage
    // board casts in dried blood instead.
    champShadow: "#7f1d1d",
    champInk: "#fff1f2",
    champMuted: "rgba(255,241,242,0.75)",
    champRule: "rgba(255,241,242,0.3)",
    chipBg: CREAM,
    chipText: "#b91c1c",
    ledgerBg: "#1f1b19",
    ledgerShadow: "#7f1d1d",
    ledgerMuted: "rgba(255,247,237,0.45)",
    divider: "rgba(255,247,237,0.14)",
    dashed: "rgba(255,247,237,0.28)",
    footerBg: CREAM,
    footerText: INK,
    footerMuted: "rgba(28,25,23,0.6)",
  },
};

const COPY: Record<
  PosterBoard,
  {
    kicker: string;
    headline: string;
    championLabel: string;
    ledgerTitle: string;
    ledgerMetric: string;
    empty: string;
    quietSub: string;
    quiet: (n: number, place: string) => string;
    caption: (place: string) => string;
  }
> = {
  roasted: {
    kicker: "🏆 hall of shame · last 24h",
    headline: "most roasted",
    championLabel: "public enemy no.1",
    ledgerTitle: "the rest of the lineup",
    ledgerMetric: "views",
    empty: "🦗 nobody got cooked here today.",
    quietSub: "slow day. fix it. 🔥",
    quiet: (n, place) => `only ${n} got cooked ${place} today.`,
    caption: (place) => `🏆 most roasted ${place} today.`,
  },
  savage: {
    kicker: "💀 burn ratings · last 24h",
    headline: "most savage",
    championLabel: "certified war crime",
    ledgerTitle: "runners-up in cruelty",
    ledgerMetric: "burn score",
    empty: "🦗 no verdicts in yet.",
    quietSub: "go rate some burns. 💀",
    quiet: (n, place) => `only ${n} roasts got judged ${place} today.`,
    caption: (place) => `💀 most savage roasts ${place} today.`,
  },
};

/** The number each board ranks on. */
function metric(board: PosterBoard, entry: LeaderboardEntry) {
  return board === "savage"
    ? (entry.average ?? 0).toFixed(1)
    : (entry.roast_count ?? 0).toLocaleString();
}

/** Read-only echo of the BurnRating widget people actually voted on. */
function FlameMeter({ average }: { average: number }) {
  const filled = Math.round(average);
  return (
    <div style={{ display: "flex", gap: 1, justifyContent: "center", fontSize: 11, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((f) => (
        // Opacity, not `filter: grayscale` — filters are the first thing to get
        // dropped on the way through foreignObject.
        <span key={f} style={{ opacity: f <= filled ? 1 : 0.25 }}>
          🔥
        </span>
      ))}
    </div>
  );
}

/** Long handles step down so the champion's name never clips or wraps. */
function handleSize(len: number) {
  if (len <= 13) return 30;
  if (len <= 18) return 26;
  if (len <= 24) return 22;
  return 18;
}

/** "in Kolkata" / "in India" / "on the internet" — whatever scope actually answered. */
function placePhrase(scope: FeedScope, label: string | null) {
  if (scope === "global" || !label) return "on the internet";
  return `in ${label}`;
}

function placeSlug(scope: FeedScope, label: string | null) {
  const base = scope === "global" || !label ? "global" : label;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stampDate(d: Date) {
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

function PosterAvatar({
  entry,
  size,
  ring,
}: {
  entry: LeaderboardEntry;
  size: number;
  ring: string;
}) {
  const [failed, setFailed] = useState(false);
  const shell = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "50%",
    border: `2px solid ${ring}`,
    overflow: "hidden",
    boxSizing: "border-box" as const,
  };

  if (failed || !entry.profile_pic_url) {
    return (
      <div
        style={{
          ...shell,
          background: "#e7e5e4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.45,
        }}
      >
        🫠
      </div>
    );
  }

  return (
    <div style={shell}>
      <img
        src={corsAvatarUrl(entry.profile_pic_url)}
        crossOrigin="anonymous"
        alt=""
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

function ChampionRow({
  entry,
  board,
  theme,
}: {
  entry: LeaderboardEntry;
  board: PosterBoard;
  theme: Theme;
}) {
  const copy = COPY[board];
  return (
    <div
      style={{
        position: "relative",
        height: CHAMPION_H,
        flexShrink: 0,
        background: theme.champBg,
        border: `3px solid ${theme.border}`,
        borderRadius: 20,
        boxShadow: `6px 6px 0 0 ${theme.champShadow}`,
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxSizing: "border-box",
        transform: "rotate(-0.6deg)",
      }}
    >
      {/* Stamped on the corner rather than sitting in the row: inline, the rank
          pushed the avatar off the card's left edge and left the composition
          limping. */}
      <div
        style={{
          position: "absolute",
          top: -11,
          left: 14,
          background: theme.chipBg,
          color: theme.chipText,
          borderRadius: 8,
          padding: "2px 9px",
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 14,
          lineHeight: 1.35,
          letterSpacing: "0.06em",
          fontVariantNumeric: "tabular-nums",
          transform: "rotate(-3deg)",
        }}
      >
        01
      </div>

      <PosterAvatar entry={entry} size={70} ring={theme.champInk} />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.champMuted,
          }}
        >
          {copy.championLabel}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: handleSize(entry.username.length),
            lineHeight: 1.2,
            color: theme.champInk,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          @{entry.username}
        </div>
      </div>

      {/* Own column, so the metric can never land on top of anything else. */}
      <div
        style={{
          flexShrink: 0,
          textAlign: "center",
          borderLeft: `2px solid ${theme.champRule}`,
          paddingLeft: 14,
          marginLeft: 4,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: 36,
            lineHeight: 1,
            color: theme.champInk,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {metric(board, entry)}
        </div>
        {board === "savage" && <FlameMeter average={entry.average ?? 0} />}
        <div
          style={{
            marginTop: 3,
            fontFamily: SANS,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: theme.champMuted,
          }}
        >
          {board === "savage"
            ? entry.votes != null
              ? `${entry.votes} votes`
              : "burn score"
            : "watched"}
        </div>
      </div>
    </div>
  );
}

function LedgerRow({
  entry,
  rank,
  last,
  board,
  theme,
}: {
  entry: LeaderboardEntry;
  rank: number;
  last: boolean;
  board: PosterBoard;
  theme: Theme;
}) {
  return (
    <div
      style={{
        // No intrinsic height: the rows share whatever the header, champion and
        // footer leave, so the board fits its frame at any entry count.
        flex: "1 1 0",
        minHeight: 0,
        maxHeight: MAX_ROW_H,
        display: "flex",
        alignItems: "center",
        gap: 13,
        borderBottom: last ? "none" : `2px dashed ${theme.divider}`,
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 13,
          color: theme.ledgerMuted,
          fontVariantNumeric: "tabular-nums",
          width: 19,
          flexShrink: 0,
        }}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <PosterAvatar entry={entry} size={34} ring={theme.text} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 17,
          color: theme.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        @{entry.username}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: 19,
          color: theme.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {metric(board, entry)}
      </span>
    </div>
  );
}

// One card with ruled rows, not four floating pills: the pills repeated the
// same border, shadow and "views" label four times and read as filler. A ledger
// labels the column once and lets the numbers line up.
function Ledger({
  entries,
  board,
  theme,
}: {
  entries: LeaderboardEntry[];
  board: PosterBoard;
  theme: Theme;
}) {
  return (
    <div
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        // Grows into the space it's given, but never past what its own rows can
        // fill — a two-name board would otherwise stretch into a blank slab.
        maxHeight: LEDGER_CHROME_H + entries.length * MAX_ROW_H,
        background: theme.ledgerBg,
        border: `3px solid ${theme.border}`,
        borderRadius: 18,
        boxShadow: `6px 6px 0 0 ${theme.ledgerShadow}`,
        padding: "9px 18px 4px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        transform: "rotate(0.4deg)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: SANS,
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: theme.ledgerMuted,
          paddingBottom: 6,
          borderBottom: `2px solid ${theme.text}`,
        }}
      >
        <span>{COPY[board].ledgerTitle}</span>
        {/* No emoji here — at 9px it renders as a grey smudge. */}
        <span>{COPY[board].ledgerMetric}</span>
      </div>

      {entries.map((entry, i) => (
        <LedgerRow
          key={entry.username}
          entry={entry}
          rank={i + 2}
          last={i === entries.length - 1}
          board={board}
          theme={theme}
        />
      ))}
    </div>
  );
}

export type LeaderboardPosterProps = {
  entries: LeaderboardEntry[];
  scope: FeedScope;
  label: string | null;
  /** Which of the two boards this post is. */
  board?: PosterBoard;
  /** Frozen at build time so the stamp matches the day the image is posted. */
  date?: Date;
};

/**
 * The post itself. Pure layout at POSTER_W x POSTER_H, inline styles only —
 * html-to-image walks computed styles, and inline values are the ones that
 * survive the trip into the canvas intact.
 */
export function LeaderboardPoster({
  entries,
  scope,
  label,
  board = "roasted",
  date = new Date(),
}: LeaderboardPosterProps) {
  const shown = entries.slice(0, POSTER_LIMIT);
  const [champion, ...runners] = shown;
  const theme = THEMES[board];
  const copy = COPY[board];
  const place = placePhrase(scope, label);

  return (
    <div
      style={{
        width: POSTER_W,
        height: POSTER_H,
        background: theme.bg,
        // Faint grid so the flat ground doesn't read as an empty JPEG in feed.
        backgroundImage: `linear-gradient(${theme.grid} 1px, transparent 1px), linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)`,
        backgroundSize: "27px 27px",
        padding: PAD,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: SANS,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.28em",
            color: theme.ledgerMuted,
          }}
        >
          <span>INSTAROASTS</span>
          <span>{stampDate(date)}</span>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "inline-block",
            background: theme.footerBg,
            color: theme.footerText,
            fontFamily: SANS,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            borderRadius: 999,
            padding: "5px 13px",
            transform: "rotate(-2deg)",
          }}
        >
          {copy.kicker}
        </div>

        <div
          style={{
            marginTop: 10,
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 36,
            lineHeight: 1.12,
            color: theme.text,
          }}
        >
          {copy.headline}{" "}
          <span
            style={{
              display: "inline-block",
              background: YELLOW,
              // Always ink on yellow — on the savage board the surrounding text
              // is cream, which would be unreadable inside the highlight.
              color: INK,
              border: `2px solid ${theme.border}`,
              borderRadius: 12,
              padding: "0 10px 3px",
              transform: "rotate(-1deg)",
            }}
          >
            {place}
          </span>{" "}
          today
        </div>
      </div>

      {/* The elastic middle. It takes exactly the space the fixed header and
          footer don't, and the rows inside divide that — which is what keeps
          the board inside its frame no matter how many entries came back or how
          long the place name is. */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: ROW_GAP,
          margin: "18px 0 16px",
        }}
      >
        {champion ? (
          <>
            <ChampionRow entry={champion} board={board} theme={theme} />
            {runners.length > 0 && <Ledger entries={runners} board={board} theme={theme} />}
            {/* A short board leaves a hole between the ledger and the footer.
                Rather than pad it with air, say the quiet part — a thin board is
                itself the invitation to get on it. */}
            {shown.length < 4 && (
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 4,
                  border: `3px dashed ${theme.dashed}`,
                  borderRadius: 18,
                  padding: "16px 18px",
                  textAlign: "center",
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: 19,
                  lineHeight: 1.35,
                  color: theme.ledgerMuted,
                  transform: "rotate(-0.5deg)",
                }}
              >
                {copy.quiet(shown.length, place)}
                <br />
                <span style={{ fontFamily: SANS, fontStyle: "normal", fontSize: 14, fontWeight: 800 }}>
                  {copy.quietSub}
                </span>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              border: `3px dashed ${theme.dashed}`,
              borderRadius: 20,
              padding: 40,
              textAlign: "center",
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: 22,
              color: theme.ledgerMuted,
            }}
          >
            {copy.empty}
          </div>
        )}
      </div>

      {/* A solid bar rather than a rule and two lines of text: it anchors the
          bottom of the frame and keeps the URL readable at thumbnail size,
          which is the only part of the poster that has a job to do. */}
      <div
        style={{
          flexShrink: 0,
          background: theme.footerBg,
          borderRadius: 16,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 20, color: theme.footerText }}>
            get roasted → instaroasts.com
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: SANS,
              fontSize: 12,
              color: theme.footerMuted,
            }}
          >
            {board === "savage"
              ? "drop any @handle. rate the burn."
              : "drop any @handle. tag whoever deserves it."}
          </div>
        </div>
        <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>
          {board === "savage" ? "💀" : "🔥"}
        </div>
      </div>
    </div>
  );
}

/* --- the button ----------------------------------------------------------- */

// Gated by `useStudioMode` at the call site: this is a content-production tool,
// not a visitor feature.

export function LeaderboardPosterButton({
  section,
  board = "roasted",
}: {
  section: LeaderboardSection | null;
  board?: PosterBoard;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const entries = section?.entries ?? [];
  const scope = section?.scope ?? "global";
  const label = section?.label ?? null;

  async function build() {
    const node = nodeRef.current;
    if (busy || !node) return;

    setBusy(true);
    setNote(null);
    track("poster_export_started", { board, scope, entries: entries.length });

    try {
      const blob = await renderCardBlob(node);
      const place = placePhrase(scope, label);
      const outcome = await shareOrDownload(
        blob,
        `instaroasts-${board}-${placeSlug(scope, label)}-${new Date()
          .toISOString()
          .slice(0, 10)}.png`,
        `${COPY[board].caption(place)}\n\nget yours → https://instaroasts.com`
      );

      if (outcome === "cancelled") setNote(null);
      else if (outcome === "shared") {
        track("poster_shared", { board, scope, method: "web_share" });
        setNote("shared 🔥");
      } else {
        track("poster_downloaded", { board, scope, method: "download" });
        setNote("saved 1080×1350 — post it 📲");
      }
    } catch (err) {
      // Same failure mode as the roast card: one avatar host answering without
      // CORS headers taints the canvas and kills the whole render.
      track("poster_export_failed", { board, scope });
      setNote("couldn't build the image — try again");
      if (import.meta.env.DEV) console.error("[poster export]", err);
    } finally {
      setBusy(false);
    }
  }

  const idle = board === "savage" ? "💀 savage post" : "🖼️ roasted post";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={build}
        disabled={busy}
        title={`Render today's ${board} board as a 1080×1350 Instagram post`}
        className="border-2 border-dashed border-foreground/50 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider bg-card hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-wait"
      >
        {busy ? "⏳ rendering…" : idle}
      </button>
      {note && <span className="text-[10px] text-muted-foreground">{note}</span>}

      {/* Laid out for real but parked offscreen — a display:none node has no
          geometry to rasterize. */}
      <div
        aria-hidden
        style={{ position: "fixed", top: 0, left: -20000, pointerEvents: "none", zIndex: -1 }}
      >
        <div ref={nodeRef} data-export={`leaderboard-poster-${board}`}>
          <LeaderboardPoster entries={entries} scope={scope} label={label} board={board} />
        </div>
      </div>
    </div>
  );
}
