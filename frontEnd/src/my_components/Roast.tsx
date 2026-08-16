import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { enqueueRoast, apiUrl } from "@/lib/api";
import { useRoastJobStream } from "@/hooks/useRoastJobStream";
import { Paywall } from "./Paywall";
import { usePacedIndex } from "@/hooks/usePacedIndex";
import type { ConfettiRef } from "@/components/ui/confetti";
import Confetti from "@/components/ui/confetti";
import { ProfileCard } from "./ProfileCard";
import { RoastCard } from "./RoastCard";
import { RoastCardPull } from "./RoastCardPull";
import { ShareBar } from "./ShareBar";
import { CompatUpsell } from "./CompatUpsell";
import { RoastProgress } from "./RoastProgress";
import { BurnRating } from "./BurnRating";
import { CreditMeter, useCredits } from "./CreditMeter";
import { track } from "@/lib/analytics";
import type { RarityId } from "@/lib/cardRarity";

interface InstagramData {
  insta_data: {
    profile_pic_url: string;
    username: string;
    full_name: string;
    follower: number;
    following: number;
    biography: string;
    post: number;
  };
  data: string;
}

// Which loading-ladder step each backend stage belongs to. Unknown stages fall
// back to step 0 rather than crashing the ladder.
const STAGE_TO_STEP: Record<string, number> = {
  queued_for_processing: 0,
  checking_cache: 0,
  scraping_profile: 1,
  uploading_image: 1,
  saving_profile: 1,
  profile_ready: 2,
  generating_roast: 3,
  saving_roast: 3,
};

function toProfileCardProps(insta_data: InstagramData["insta_data"]) {
  return {
    handle: insta_data.username,
    displayName: insta_data.full_name,
    avatarUrl: insta_data.profile_pic_url,
    posts: insta_data.post,
    followers: insta_data.follower,
    following: insta_data.following,
    bio: insta_data.biography,
  };
}

export function Roast() {
  const confettiRef = useRef<ConfettiRef>(null);

  const { username } = useParams();
  const searchParams = new URLSearchParams(useLocation().search);
  const ln = searchParams.get("language") || "english";
  const [isRunning, setIsRunning] = useState(false);
  // Tier of the card once it's face-up, reported up by RoastCardPull. Drives
  // the aura on the profile card above it, so opening the card lights up the
  // whole page rather than just the card itself.
  const [cardTier, setCardTier] = useState<RarityId | null>(null);
  // Bumped on every roast attempt so the loading ladder restarts even when the
  // username stays the same (re-roast, post-checkout retry).
  const [runId, setRunId] = useState(0);
  const { status, stage, stageMessage, partial, result, error, cached, paywallInfo, start } =
    useRoastJobStream<InstagramData>();
  // Re-rolls always cost a paid credit where monetization is on — say so on the
  // button instead of springing the paywall on the most-engaged click.
  const credits = useCredits();
  const rerollCostsCredit = credits?.monetizationEnabled === true;

  const loadingSteps = [
    { icon: "🔍", label: `finding @${username} on Instagram` },
    { icon: "📡", label: "fetching the account" },
    { icon: "🧠", label: "AI reading the vibes" },
    { icon: "🌶️", label: "roasting mercilessly" },
    { icon: "🍽️", label: "serving it hot" },
  ];
  // Real progress → ladder step; the paced index walks toward it one visible
  // beat at a time so fast jobs still show every stage.
  const targetStep = status === "done" ? loadingSteps.length : STAGE_TO_STEP[stage ?? ""] ?? 0;
  // Keyed on the run, not just the username: a re-roast stays on the same
  // username, and without the counter the ladder would still be parked at its
  // final step and skip the whole build-up.
  const displayedStep = usePacedIndex(targetStep, `${username}:${runId}`);

  // Hold the loading screen until the ladder finishes its last beat, even if
  // the result already arrived — the payoff lands harder after the build-up.
  // Exception: a fully-cached roast skips the animation and loads instantly.
  const received = status === "done" && (cached || displayedStep >= loadingSteps.length);
  const userData = result;
  const roastData = result?.data ?? "";
  const liveInstaData = partial?.insta_data ?? null;
  // Reveal the real profile card only once the ladder reaches the "AI reading
  // the vibes" step, so the card appearing reads as that step's reward.
  const showLiveProfile = liveInstaData !== null && displayedStep >= 2;

  // Shared by the initial run and the post-payment retry. `reroll` pays a credit
  // to regenerate a roast that already exists rather than serving the cached one.
  const runRoast = (reroll = false) => {
    setRunId((n) => n + 1);
    return start(
      () =>
        enqueueRoast<InstagramData>("/api/v1/roastMe", { name: username, language: ln, reroll }),
      apiUrl
    );
  };

  // Remembered so the post-payment retry regenerates rather than handing back
  // the cached roast they just paid to replace.
  const wasReroll = useRef(false);
  const rerollRoast = () => {
    track("reroll_clicked");
    wasReroll.current = true;
    runRoast(true);
  };

  useEffect(() => {
    if (username) document.title = `Roast of ${username} 🔥`;
    wasReroll.current = false;
    runRoast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    if (received) {
      // The moment the product actually delivered — pair with paywall_shown and
      // roast_failed to see where the funnel leaks.
      track("roast_delivered", { cached: !!cached, reroll: wasReroll.current });
      setIsRunning(true);
      const timeout = setTimeout(() => setIsRunning(false), 5000);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [received]);

  useEffect(() => {
    if (status === "failed") {
      track("roast_failed", { reason: (error ?? "").split(": ")[0] || "unknown" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "paywall" && paywallInfo) {
    return <Paywall info={paywallInfo} onUnlocked={() => runRoast(wasReroll.current)} />;
  }

  if (status === "failed") {
    const [code, ...rest] = (error ?? "").split(": ");
    const isNotFound = code === "NOT_FOUND";
    const detail = rest.join(": ");

    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-6">
        <div className="text-7xl animate-bounce">{isNotFound ? "🕵️‍♂️" : "🥵"}</div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold italic text-balance">
          {isNotFound ? <>couldn't find @{username} anywhere</> : "our roast chefs are overwhelmed"}
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {isNotFound
            ? "double-check the username — it might be misspelled, deactivated, or private."
            : detail || "give it a minute and try again."}
        </p>
        <Link to="/" className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold hover:-translate-y-0.5 transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))]">
          ← try another username
        </Link>
      </div>
    );
  }

  if (!received) {
    const loadingUrl = `https://instaroasts.com/${username}`;
    return (
      <div className="relative overflow-hidden px-6 py-12">
        <Helmet>
          <title>Roast of @{username} — InstaRoasts</title>
          <meta name="description" content={`AI-generated roast of @${username} on InstaRoasts — drop any Instagram handle and get roasted in seconds.`} />
          <link rel="canonical" href={loadingUrl} />
          <meta property="og:url" content={loadingUrl} />
          <meta property="og:title" content={`Roast of @${username} — InstaRoasts`} />
          <meta name="robots" content="index, follow" />
        </Helmet>
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Loading ladder: paced through every stage for the build-up */}
          <RoastProgress steps={loadingSteps} activeIndex={displayedStep} />

          {/* Profile: real card once scraped AND the ladder caught up, skeleton until then */}
          {showLiveProfile && liveInstaData ? (
            <div className="animate-reveal">
              <ProfileCard profile={toProfileCardProps(liveInstaData)} />
            </div>
          ) : (
            <div className="bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal animate-pulse">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="size-28 rounded-full bg-muted border-2 border-foreground shrink-0" />
                <div className="flex-1 w-full space-y-3">
                  <div className="h-6 bg-muted rounded-xl w-40" />
                  <div className="h-8 bg-muted rounded-xl w-56" />
                  <div className="flex gap-2 mt-4">
                    <div className="h-8 bg-muted rounded-full w-20" />
                    <div className="h-8 bg-muted rounded-full w-24" />
                    <div className="h-8 bg-muted rounded-full w-22" />
                  </div>
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
              </div>
            </div>
          )}
          {/* Roast card skeleton */}
          <div className="bg-card border-2 border-foreground rounded-3xl p-8 shadow-brutal animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded-xl w-32" />
            <div className="h-5 bg-muted rounded w-full" />
            <div className="h-5 bg-muted rounded w-[95%]" />
            <div className="h-5 bg-muted rounded w-[88%]" />
            <div className="h-5 bg-muted rounded w-full" />
            <div className="h-5 bg-muted rounded w-[75%]" />
          </div>
          <p className="text-center text-sm text-muted-foreground italic">
            {stageMessage || "⏳ crafting your roast… hang tight"}
          </p>
        </div>
      </div>
    );
  }

  if (!userData) return null;

  const { insta_data } = userData;
  const profile = toProfileCardProps(insta_data);
  const shareTitle = `Here is the roast for ${insta_data.full_name} @${insta_data.username} 🔥`;

  const roastSnippet = roastData.substring(0, 200).replace(/[#*_`]/g, "");
  const pageUrl = `https://instaroasts.com/${insta_data.username}`;

  return (
    <div className="relative overflow-hidden px-6 py-12">
      <Helmet>
        <title>Roast of @{insta_data.username} 🔥 — InstaRoasts</title>
        <meta name="description" content={`AI roast of @${insta_data.username}: ${roastSnippet}...`} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={`Roast of @${insta_data.username} 🔥`} />
        <meta property="og:description" content={roastSnippet} />
        <meta property="og:image" content={insta_data.profile_pic_url} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Roast of @${insta_data.username} 🔥`} />
        <meta name="twitter:description" content={roastSnippet} />
        <meta name="twitter:image" content={insta_data.profile_pic_url} />
      </Helmet>

      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-20 size-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-yellow-300/20 blur-3xl" />

      <div className="max-w-3xl mx-auto space-y-10">
        {/* Back button */}
        <div className="animate-reveal flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold hover:-translate-y-0.5 hover:rotate-[-2deg] transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))]"
          >
            ← roast someone else
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <CreditMeter />
            <button
              type="button"
              onClick={rerollRoast}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground border-2 border-foreground rounded-full px-4 py-2 text-sm font-black hover:-translate-y-0.5 hover:rotate-2 transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))]"
            >
              🔁 roast them again{rerollCostsCredit ? " · 1 credit" : ""}
            </button>
          </div>
        </div>

        {/* Heading */}
        <div className="animate-reveal [animation-delay:100ms] text-center space-y-4">
          <div className="inline-block bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest rotate-[-2deg]">
            🚨 roast incoming
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold italic text-balance leading-[1.05]">
            we cooked{" "}
            <span className="text-primary underline decoration-wavy decoration-accent underline-offset-4">
              @{insta_data.username}
            </span>{" "}
            🍳🔥
          </h1>
          <p className="text-muted-foreground text-base">brace yourself — no feelings were spared.</p>
        </div>

        {/* Profile Card */}
        <div className="animate-reveal [animation-delay:200ms]">
          <ProfileCard profile={profile} cardTier={cardTier} />
        </div>

        {/* Roast Card */}
        <div className="animate-reveal [animation-delay:300ms] pt-4">
          <RoastCard roast={roastData} />
        </div>

        {/* Collectible card: the pull is the share hook, so it sits directly
            under the roast rather than below the fold */}
        <div className="animate-reveal [animation-delay:320ms] pt-4">
          <RoastCardPull
            username={insta_data.username}
            roast={roastData}
            language={ln}
            profile={profile}
            onReroll={rerollRoast}
            rerollCostsCredit={rerollCostsCredit}
            onRevealChange={setCardTier}
          />
        </div>

        {/* Community verdict */}
        <div className="animate-reveal [animation-delay:350ms]">
          <BurnRating username={insta_data.username} />
        </div>

        {/* Share */}
        <div className="animate-reveal [animation-delay:400ms] space-y-4 text-center">
          <p className="font-serif italic text-lg">too good not to share 👇</p>
          <ShareBar title={shareTitle} text={roastData} source="roast" />
        </div>

        {/* Compatibility upsell: last block on the page, so it catches everyone
            who read to the end — turns a one-person share into a two-person run */}
        <div className="animate-reveal [animation-delay:450ms]">
          <CompatUpsell username={insta_data.username} language={ln} />
        </div>
      </div>

      {isRunning && (
        <Confetti
          ref={confettiRef}
          className="absolute left-0 top-0 z-0 size-full"
        />
      )}
    </div>
  );
}
