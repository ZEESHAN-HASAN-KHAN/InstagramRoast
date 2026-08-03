import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import confetti from "canvas-confetti";
import { mintCard } from "@/lib/cardRarity";
import {
  CARD_H,
  CARD_W,
  RoastTradingCard,
  STORY_BACKDROPS,
  type CardProfile,
} from "./RoastTradingCard";
import type { Rarity } from "@/lib/cardRarity";
import {
  cardFilename,
  renderCardBlob,
  shareOrDownload,
  type ExportFormat,
} from "@/lib/cardExport";
import { track } from "@/lib/analytics";
import { getCardCounts, getCardState, revealCard } from "@/lib/api";

// The story canvas exports at 1080x1920; like the card it's laid out at half
// that and rasterized at 2x.
const STORY_W = 540;
const STORY_H = 960;

// A card is only pulled once. Having flipped it, coming back to the page —
// reloading, following a shared link back, opening it again tomorrow — finds it
// face-up instead of asking for the same tap again.
//
// The record lives in the database against the roast itself (see the
// card_reveals table), keyed by the same viewer identity the ratings use. A
// re-roast is a different roast and therefore a genuinely new card, so it comes
// back face-down and has to be earned.

type RoastCardPullProps = {
  username: string;
  roast: string;
  /** Which roast is on screen — the card is per language, like the roast. */
  language: string;
  profile: CardProfile;
  /** Re-roll is the paid path out of a bad pull, so the card offers it directly. */
  onReroll: () => void;
  rerollCostsCredit: boolean;
};

export function RoastCardPull({
  username,
  roast,
  language,
  profile,
  onReroll,
  rerollCostsCredit,
}: RoastCardPullProps) {
  const identity = useMemo(() => mintCard(username, roast), [username, roast]);
  const { rarity } = identity;

  const [phase, setPhase] = useState<"back" | "suspense" | "front">("back");
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // The card is laid out at a fixed 540px and scaled down to whatever space the
  // page actually has, so the exported image matches what was on screen.
  const [displayWidth, setDisplayWidth] = useState(CARD_W);

  const holderRef = useRef<HTMLDivElement>(null);
  const cardNodeRef = useRef<HTMLDivElement>(null);
  const storyNodeRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const measure = () => setDisplayWidth(Math.min(CARD_W, el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Site-wide scarcity, shown once the card is face-up. Optional by design: a
  // failed lookup just falls back to the printed pull rate rather than blocking
  // the reveal on a number.
  const [minted, setMinted] = useState<number | null>(null);

  useEffect(() => {
    track("card_minted", { tier: rarity.id, serial: identity.serial });
  }, [rarity.id, identity.serial]);

  useEffect(() => {
    let cancelled = false;
    getCardCounts()
      .then(({ counts }) => {
        if (!cancelled) setMinted(counts[rarity.id] ?? null);
      })
      .catch(() => {
        if (!cancelled) setMinted(null);
      });
    return () => {
      cancelled = true;
    };
  }, [rarity.id]);

  // A new roast (re-roll) is a new pull — put the card face-down so the reveal
  // is earned rather than spoiled. Any suspense timer still pending belongs to
  // the card that was just replaced; letting it fire would flip the new one
  // open on its own and report a reveal nobody watched.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("back");
    setNote(null);
  }, [username, identity.serial]);

  // Then ask the server whether this viewer already opened this card. Only
  // promotes a card that's still face-down: if they tapped while this was in
  // flight, the suspense they're watching must be allowed to finish rather than
  // being cut short by a late answer.
  useEffect(() => {
    let cancelled = false;
    getCardState(username, language)
      .then(({ revealed }) => {
        if (cancelled || !revealed) return;
        setPhase((current) => (current === "back" ? "front" : current));
      })
      .catch(() => {
        // Unreachable API just means they tap again — strictly better than a
        // card stuck face-down or a page that fails to render.
      });
    return () => {
      cancelled = true;
    };
  }, [username, language, identity.serial]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    []
  );

  function celebrate() {
    const colors = rarity.confettiColors;
    const intensity = rarity.id === "diamond" ? 3 : rarity.id === "golden" ? 2 : 1;

    confetti({ particleCount: 60 * intensity, spread: 70, origin: { y: 0.55 }, colors });
    if (intensity > 1) {
      timers.current.push(
        window.setTimeout(
          () =>
            confetti({
              particleCount: 50 * intensity,
              spread: 120,
              startVelocity: 45,
              origin: { y: 0.5 },
              colors,
            }),
          220
        )
      );
    }
  }

  function reveal() {
    if (phase !== "back") return;
    track("card_reveal_started", { tier: rarity.id });
    setPhase("suspense");
    timers.current.push(
      window.setTimeout(() => {
        setPhase("front");
        // Not awaited: the flip is the payoff and must not wait on a round
        // trip. A failed write only costs them the tap on a later visit.
        revealCard(username, language).catch(() => {});
        celebrate();
        // Only a live flip counts as a reveal. Restoring a recorded one on a
        // later visit is not a second pull and must not inflate the funnel.
        track("card_revealed", { tier: rarity.id, pull_rate: rarity.pullRate });
      }, rarity.suspenseMs)
    );
  }

  async function exportCard(format: ExportFormat) {
    if (busy) return;
    const node = (format === "story" ? storyNodeRef : cardNodeRef).current;
    if (!node) return;

    setBusy(format);
    setNote(null);
    track("card_export_started", { tier: rarity.id, format });

    try {
      const blob = await renderCardBlob(node);
      // The deep link rides in the caption: WhatsApp attaches the image and
      // leaves the text editable, so without a real URL here the image spreads
      // but nothing clicks back.
      // The observed count beats the design probability as a brag, so use it
      // when it loaded and fall back to the pull rate when it didn't.
      const scarcity =
        minted !== null && rarity.id !== "common"
          ? `only ${minted.toLocaleString()} ever pulled`
          : `${rarity.pullRate}% pull rate`;
      const outcome = await shareOrDownload(
        blob,
        cardFilename(profile.handle, format),
        `@${profile.handle} pulled a ${rarity.name} roast card 🔥 (${scarcity})\n` +
          `get roasted → https://instaroasts.com/${profile.handle}`
      );

      if (outcome === "cancelled") {
        setNote(null);
      } else if (outcome === "shared") {
        track("card_shared", { tier: rarity.id, format, method: "web_share" });
        setNote("shared! 🔥");
      } else {
        track("card_downloaded", { tier: rarity.id, format, method: "download" });
        setNote("saved to your downloads — post it 📲");
      }
    } catch (err) {
      // Almost always a tainted canvas, i.e. the avatar host answered without
      // CORS headers. Nothing the user can do, so don't pretend otherwise.
      track("card_export_failed", { tier: rarity.id, format });
      setNote("couldn't build the image — try again in a sec");
      if (import.meta.env.DEV) console.error("[card export]", err);
    } finally {
      setBusy(null);
    }
  }

  const revealed = phase === "front";

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="inline-block bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest rotate-[2deg]">
          🎴 your roast card
        </div>
        <p className="text-sm text-muted-foreground">
          {revealed
            ? rarity.tagline
            : "every roast mints one card. rarity is pure luck."}
        </p>
      </div>

      <div ref={holderRef} className="flex justify-center">
        {phase === "front" ? (
          <div className="animate-reveal">
            <RoastTradingCard
              identity={identity}
              profile={profile}
              width={displayWidth}
              mode="live"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={reveal}
            aria-label="Reveal your roast card"
            className={phase === "suspense" ? "card-suspense" : "card-idle-bob"}
            style={{ width: displayWidth, height: CARD_H * (displayWidth / CARD_W) }}
          >
            <CardBack
              width={displayWidth}
              label={phase === "suspense" ? "opening…" : "tap to reveal"}
            />
          </button>
        )}
      </div>

      {revealed && (
        <div className="animate-reveal space-y-3">
          {minted !== null && (
            <p className="text-center">
              <span className="inline-block bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground rounded-full px-4 py-1.5 text-xs font-black rotate-[-1deg] shadow-[3px_3px_0_0_hsl(0_0%_8%)]">
                {rarity.id === "common"
                  ? // A common pull is the one number that reads as a reason to
                    // roll again rather than as a brag.
                    `😐 ${minted.toLocaleString()} people pulled this exact card`
                  : `🏆 only ${minted.toLocaleString()} ${rarity.name}s have ever been pulled`}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => exportCard("story")}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground border-2 border-foreground rounded-full px-5 py-2.5 text-sm font-black shadow-[3px_3px_0_0_hsl(0_0%_8%)] hover:-translate-y-0.5 hover:rotate-1 transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              {busy === "story" ? "⏳ building…" : "📸 share to story"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => exportCard("card")}
              className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-5 py-2.5 text-sm font-bold shadow-[3px_3px_0_0_hsl(0_0%_8%)] hover:-translate-y-0.5 hover:-rotate-1 transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              {busy === "card" ? "⏳ building…" : "⬇️ download card"}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground h-4">{note}</p>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                track("reroll_clicked_from_card", { tier: rarity.id });
                onReroll();
              }}
              className="text-xs font-bold underline decoration-wavy underline-offset-4 hover:text-primary transition-colors"
            >
              🎲 re-roll for a rarer card{rerollCostsCredit ? " · 1 credit" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Offscreen render surfaces. These have to be laid out for real — a
          display:none node has no geometry to rasterize — so they're parked
          outside the viewport instead of hidden. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: -20000,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div ref={cardNodeRef} data-export="card" style={{ width: CARD_W, height: CARD_H }}>
          <RoastTradingCard identity={identity} profile={profile} mode="export" />
        </div>
        <div ref={storyNodeRef} data-export="story">
          <StoryFrame handle={profile.handle} rarity={rarity}>
            <RoastTradingCard
              identity={identity}
              profile={profile}
              mode="export"
              width={452}
            />
          </StoryFrame>
        </div>
      </div>
    </div>
  );
}

// Identical for every tier — a back that hinted at rarity would give away the
// pull before the flip.
function CardBack({ width, label }: { width: number; label: string }) {
  const scale = width / CARD_W;
  return (
    <div style={{ width, height: CARD_H * scale, cursor: "pointer" }}>
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          borderRadius: 32,
          padding: 16,
          boxSizing: "border-box",
          background: "linear-gradient(145deg,#292524,#57534e 45%,#1c1917)",
          boxShadow: "12px 12px 0 0 hsl(0 0% 8%)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 22,
            border: "2px solid rgba(249,115,22,0.5)",
            background:
              "repeating-linear-gradient(45deg,#1c1917 0px,#1c1917 18px,#231f1d 18px,#231f1d 36px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: 86, lineHeight: 1 }}>🔥</div>
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: "0.32em",
              color: "#fff7ed",
            }}
          >
            INSTAROASTS
          </div>
          <div
            style={{
              fontFamily: "Playfair Display, Georgia, serif",
              fontStyle: "italic",
              fontSize: 19,
              color: "rgba(255,247,237,0.75)",
            }}
          >
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

// 9:16 wrapper so the exported story image is full-bleed in Instagram rather
// than a card floating on whatever background IG picks.
function StoryFrame({
  handle,
  rarity,
  children,
}: {
  handle: string;
  rarity: Rarity;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: STORY_W,
        height: STORY_H,
        background: STORY_BACKDROPS[rarity.id],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "46px 24px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "0.3em",
            color: "rgba(255,247,237,0.65)",
          }}
        >
          INSTAROASTS
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: "Playfair Display, Georgia, serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 30,
            color: "#fff7ed",
          }}
        >
          @{handle} got roasted 🔥
        </div>
        {/* Names the pull in the story itself — the brag has to survive being
            seen for two seconds without the card being read. */}
        <div
          style={{
            marginTop: 14,
            display: "inline-block",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,247,237,0.9)",
            border: "1px solid rgba(255,247,237,0.35)",
            borderRadius: 999,
            padding: "5px 14px",
          }}
        >
          {rarity.emoji} pulled a {rarity.name} · {rarity.pullRate}%
        </div>
      </div>

      {children}

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 17,
            fontWeight: 900,
            color: "#fff7ed",
          }}
        >
          get your card → instaroasts.com
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 13,
            color: "rgba(255,247,237,0.55)",
          }}
        >
          drop any @handle. see what you pull.
        </div>
      </div>
    </div>
  );
}
