import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { createToken } from "@/lib/utils";
import { useRoastJobStream } from "@/hooks/useRoastJobStream";
import { usePacedIndex } from "@/hooks/usePacedIndex";
import type { ConfettiRef } from "@/components/ui/confetti";
import Confetti from "@/components/ui/confetti";
import { ProfileCard } from "./ProfileCard";
import { RoastCard } from "./RoastCard";
import { ShareBar } from "./ShareBar";
import { AdBanner } from "./AdBanner";
import { RoastProgress } from "./RoastProgress";

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
  const { status, stage, stageMessage, partial, result, error, cached, start } = useRoastJobStream<InstagramData>();

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
  const displayedStep = usePacedIndex(targetStep, username);

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

  useEffect(() => {
    if (username) document.title = `Roast of ${username} 🔥`;
    const apiUrl = import.meta.env.VITE_APP_BASE_URL;
    start(async () => {
      const token = await createToken();
      const response = await fetch(apiUrl + "/api/v1/roastMe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: username, language: ln }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    }, apiUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    if (received) {
      setIsRunning(true);
      const timeout = setTimeout(() => setIsRunning(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [received]);

  if (status === "failed") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-lg font-bold">😬 something went wrong roasting @{username}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold">
          ← try again
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
        <div className="animate-reveal flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold hover:-translate-y-0.5 hover:rotate-[-2deg] transition-all shadow-[3px_3px_0_0_hsl(0_0%_8%)]"
          >
            ← roast someone else
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground rounded-full px-3 py-1 rotate-2">
            🍿 grab popcorn
          </span>
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
          <ProfileCard profile={profile} />
        </div>

        {/* Ad between profile and roast */}
        <AdBanner slot="5114214544" />

        {/* Roast Card */}
        <div className="animate-reveal [animation-delay:300ms] pt-4">
          <RoastCard roast={roastData} />
        </div>

        {/* Share */}
        <div className="animate-reveal [animation-delay:400ms] space-y-4 text-center">
          <p className="font-serif italic text-lg">too good not to share 👇</p>
          <ShareBar title={shareTitle} text={roastData} />
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
