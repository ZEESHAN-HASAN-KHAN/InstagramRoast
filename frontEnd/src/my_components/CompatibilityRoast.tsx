import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { enqueueRoast, apiUrl } from "@/lib/api";
import { useRoastJobStream } from "@/hooks/useRoastJobStream";
import { usePacedIndex } from "@/hooks/usePacedIndex";
import InstaCard from "./InstaCard";
import { RoastProgress } from "./RoastProgress";
import { ShareBar } from "./ShareBar";
import { Paywall } from "./Paywall";

// Which loading-ladder step each backend stage belongs to. Unknown stages fall
// back to step 0 rather than crashing the ladder.
const STAGE_TO_STEP: Record<string, number> = {
  queued_for_processing: 0,
  checking_cache: 0,
  scraping_profile_1: 1,
  uploading_image_1: 1,
  saving_profile_1: 1,
  profile_1_ready: 2,
  scraping_profile_2: 2,
  uploading_image_2: 2,
  saving_profile_2: 2,
  profile_2_ready: 3,
  generating_roast: 3,
  saving_roast: 3,
};

export function CompatiblityRoast() {
  interface UserData {
    profile_pic_url: string;
    username: string;
    full_name: string;
    follower: number;
    following: number;
    biography: string;
    post: number;
  }

  interface CompatibilityResult {
    userData1: UserData;
    userData2: UserData;
    compatibilityText: string;
  }

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const uname1 = queryParams.get("uname1");
  const uname2 = queryParams.get("uname2");
  const language = queryParams.get("language");

  const { status, stage, stageMessage, partial, result, error, cached, paywallInfo, start } =
    useRoastJobStream<CompatibilityResult>();

  const loadingSteps = [
    { icon: "🔍", label: "finding both profiles" },
    { icon: "📡", label: `fetching @${uname1}` },
    { icon: "📡", label: `fetching @${uname2}` },
    { icon: "💘", label: "judging the match-up" },
    { icon: "💀", label: "delivering the verdict" },
  ];
  // Real progress → ladder step; the paced index walks toward it one visible
  // beat at a time so fast (cached) jobs still show every stage.
  const targetStep = status === "done" ? loadingSteps.length : STAGE_TO_STEP[stage ?? ""] ?? 0;
  const displayedStep = usePacedIndex(targetStep, `${uname1}|${uname2}`);

  // Hold the loading screen until the ladder finishes its last beat, even if
  // the result already arrived — the payoff lands harder after the build-up.
  // Exception: a fully-cached roast skips the animation and loads instantly.
  const received = status === "done" && (cached || displayedStep >= loadingSteps.length);

  // Each profile renders as soon as it's scraped, well before the compatibility
  // text (and possibly the other profile) is ready — but gated on the ladder
  // reaching that profile's step, so the card appearing reads as its reward.
  const userData1 = result?.userData1 ?? partial?.userData1 ?? null;
  const userData2 = result?.userData2 ?? partial?.userData2 ?? null;
  const showLiveProfile1 = userData1 !== null && (received || displayedStep >= 2);
  const showLiveProfile2 = userData2 !== null && (received || displayedStep >= 3);
  const compatibilityRoast = result?.compatibilityText ?? "";

  const renderedMarkdown = useMemo(
    () => (
      <div className="prose break-words whitespace-normal font-serif text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{compatibilityRoast}</ReactMarkdown>
      </div>
    ),
    [compatibilityRoast]
  );

  // Shared by the initial run and the post-payment retry.
  const runRoast = () =>
    start(
      () =>
        enqueueRoast<CompatibilityResult>("/api/v1/compatibilityRoast", {
          uname1,
          uname2,
          language,
        }),
      apiUrl
    );

  useEffect(() => {
    if (uname1 === null || uname2 === null || language === null) {
      navigate("/");
      return;
    }
    runRoast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "paywall" && paywallInfo) {
    return <Paywall info={paywallInfo} onUnlocked={runRoast} />;
  }

  if (status === "failed") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-lg font-bold">😬 something went wrong comparing @{uname1} and @{uname2}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!received) {
    const cardSkeleton = (
      <div className="bg-card border-2 border-foreground rounded-3xl p-6 shadow-brutal w-full max-w-sm animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <div className="size-24 rounded-full bg-muted border-2 border-foreground" />
          <div className="h-5 bg-muted rounded-xl w-32" />
          <div className="h-7 bg-muted rounded-xl w-44" />
          <div className="flex gap-2">
            <div className="h-7 bg-muted rounded-full w-20" />
            <div className="h-7 bg-muted rounded-full w-24" />
          </div>
        </div>
      </div>
    );

    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Loading ladder: paced through every stage for the build-up */}
        <RoastProgress steps={loadingSteps} activeIndex={displayedStep} />

        <div className="flex flex-col lg:flex-row justify-center items-center gap-8">
          {/* Profile 1: real card once scraped AND the ladder caught up, skeleton until then */}
          {showLiveProfile1 && userData1 ? (
            <div className="animate-reveal w-full max-w-sm">
              <InstaCard insta_data={userData1} />
            </div>
          ) : (
            cardSkeleton
          )}

          <div className="shrink-0 size-12 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-sm shadow-brutal">
            VS
          </div>

          {/* Profile 2: real card once scraped AND the ladder caught up, skeleton until then */}
          {showLiveProfile2 && userData2 ? (
            <div className="animate-reveal w-full max-w-sm">
              <InstaCard insta_data={userData2} />
            </div>
          ) : (
            cardSkeleton
          )}
        </div>
        <p className="text-center text-sm text-muted-foreground italic">
          {stageMessage || "⏳ analysing compatibility… hang tight"}
        </p>
      </div>
    );
  }

  const compatSnippet = compatibilityRoast.substring(0, 200).replace(/[#*_`]/g, "");
  const pageUrl = `https://instaroasts.com/compatibilityRoast?uname1=${uname1}&uname2=${uname2}&language=${language}`;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
      <Helmet>
        <title>@{uname1} vs @{uname2} Compatibility Roast 💀 — InstaRoasts</title>
        <meta name="description" content={`AI compatibility roast between @${uname1} and @${uname2}: ${compatSnippet}...`} />
        <link rel="canonical" href="https://instaroasts.com/compatibilityRoast" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={`@${uname1} vs @${uname2} Compatibility Roast 💀`} />
        <meta property="og:description" content={compatSnippet} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`@${uname1} vs @${uname2} Compatibility Roast 💀`} />
        <meta name="twitter:description" content={compatSnippet} />
      </Helmet>

      {/* Profile cards */}
      <div className="flex flex-col lg:flex-row justify-center items-center gap-8">
        {userData1 && <InstaCard insta_data={userData1} />}
        <div className="shrink-0 size-12 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-sm shadow-brutal">
          VS
        </div>
        {userData2 && <InstaCard insta_data={userData2} />}
      </div>

      {/* Share bar — same component the single-roast page uses, so Instagram,
          the copy fallback and the share analytics stay in one place */}
      <ShareBar
        title={`@${uname1} vs @${uname2} — the compatibility verdict is in 💀`}
        text={compatibilityRoast}
        source="compat"
      />

      {/* Compatibility roast card */}
      <div className="relative">
        <div className="absolute -top-6 -left-3 text-4xl rotate-[-18deg] animate-float pointer-events-none select-none">❤️‍🔥</div>
        <div className="absolute -top-8 right-4 text-5xl rotate-[14deg] animate-float [animation-delay:1s] pointer-events-none select-none">💀</div>

        <article className="relative bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 dark:from-pink-900/30 dark:via-rose-900/30 dark:to-orange-900/30 border-2 border-foreground rounded-3xl p-8 md:p-10 shadow-brutal rotate-[-0.6deg]">
          <div className="absolute -top-4 left-6 bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full rotate-[-4deg] shadow-md">
            🎭 compatibility verdict
          </div>
          <span
            aria-hidden
            className="absolute -top-2 left-2 font-serif italic text-8xl text-primary leading-none select-none opacity-70"
          >
            "
          </span>
          <div className="relative pt-4 font-serif text-lg md:text-xl leading-relaxed text-foreground">
            {renderedMarkdown}
          </div>
          <div className="mt-8 pt-6 border-t-2 border-dashed border-foreground/30 flex items-center justify-between text-sm">
            <span className="font-bold">— your AI matchmaker 😈</span>
            <span className="text-2xl">✨❤️‍🔥✨</span>
          </div>
        </article>
      </div>
    </div>
  );
}
