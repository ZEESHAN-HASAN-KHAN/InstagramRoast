import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { enqueueRoast, apiUrl } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useRoastJobStream } from "@/hooks/useRoastJobStream";
import { usePacedIndex } from "@/hooks/usePacedIndex";
import InstaCard from "./InstaCard";
import { RoastProgress } from "./RoastProgress";
import { ShareBar } from "./ShareBar";
import { Paywall } from "./Paywall";
import { CosmicVerdict } from "./CosmicVerdict";
import { CosmicDeep } from "./CosmicDeep";
import { CosmicPrompt } from "./CosmicPrompt";

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

  // Everything past `compatibilityText` is Cosmic Match and optional: a
  // pairing run without birth dates, or a model response that ignored the
  // output shape, still arrives with just the text and renders as before.
  interface Sign {
    name: string;
    emoji?: string;
    element?: string;
  }

  interface CompatibilityResult {
    userData1: UserData;
    userData2: UserData;
    compatibilityText: string;
    score?: number | null;
    greenFlag?: string | null;
    redFlag?: string | null;
    verdict?: string | null;
    sign1?: Sign | null;
    sign2?: Sign | null;
  }

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const uname1 = queryParams.get("uname1");
  const uname2 = queryParams.get("uname2");
  const language = queryParams.get("language");
  const dob1 = queryParams.get("dob1");
  const dob2 = queryParams.get("dob2");

  const { status, stage, stageMessage, partial, result, error, cached, paywallInfo, start } =
    useRoastJobStream<CompatibilityResult>();

  const isCosmic = Boolean(dob1 || dob2);

  const loadingSteps = [
    { icon: "🔍", label: "finding both profiles" },
    { icon: "📡", label: `fetching @${uname1}` },
    { icon: "📡", label: `fetching @${uname2}` },
    { icon: isCosmic ? "🔮" : "💘", label: isCosmic ? "reading both charts" : "judging the match-up" },
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
  const score = result?.score ?? null;
  const sign1 = result?.sign1 ?? null;
  const sign2 = result?.sign2 ?? null;
  const greenFlag = result?.greenFlag ?? null;
  const redFlag = result?.redFlag ?? null;
  const verdict = result?.verdict ?? null;

  // The flags and verdict are rendered as their own UI elements, so leaving
  // them in the prose too would print each of them twice. Stripped by exact
  // line match rather than by emoji prefix: a model that opens a body sentence
  // with the same emoji should not have that sentence silently deleted.
  const bodyMarkdown = useMemo(() => {
    const consumed = [greenFlag, redFlag, verdict].filter(Boolean);
    if (!consumed.length) return compatibilityRoast;
    return compatibilityRoast
      .split("\n")
      .filter((line) => !consumed.some((value) => line.includes(value as string)))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }, [compatibilityRoast, greenFlag, redFlag, verdict]);

  const renderedMarkdown = useMemo(
    () => (
      <div className="prose break-words whitespace-normal font-serif text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyMarkdown}</ReactMarkdown>
      </div>
    ),
    [bodyMarkdown]
  );

  // Shared by the initial run and the post-payment retry.
  const runRoast = () =>
    start(
      () =>
        enqueueRoast<CompatibilityResult>("/api/v1/compatibilityRoast", {
          uname1,
          uname2,
          language,
          dob1,
          dob2,
        }),
      apiUrl
    );

  // Top of the Cosmic Match funnel. `compatibility_submitted` counts intent at
  // the form; this counts a reading that actually landed, which is the only
  // number the unlock rate can honestly be divided by.
  //
  // Keyed on the pairing so a re-run with birth dates reports a second, cosmic
  // delivery rather than being swallowed as a repeat of the plain one.
  const deliveryKey = received ? `${uname1}|${uname2}|${dob1 ?? ""}|${dob2 ?? ""}` : null;
  useEffect(() => {
    if (!deliveryKey) return;
    track("cosmic_match_delivered", {
      variant: isCosmic ? "cosmic" : "plain",
      result: cached ? "cached" : "fresh",
      // A metric, not a dimension: the useful question is whether low scores
      // convert better than high ones, which needs an average, not 101 buckets.
      score: score ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryKey]);

  useEffect(() => {
    if (uname1 === null || uname2 === null || language === null) {
      navigate("/");
      return;
    }
    runRoast();
    // Depends on the query params, not [], so adding birth dates to the URL
    // re-runs the same pairing in place. Safe to fire again: start() bumps a
    // request id and resets to IDLE, so the first run's stream and response are
    // discarded rather than racing the second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uname1, uname2, language, dob1, dob2]);

  if (status === "paywall" && paywallInfo) {
    return <Paywall info={paywallInfo} surface="compat" onUnlocked={runRoast} />;
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
  const ogTitle =
    score !== null
      ? `@${uname1} × @${uname2} are a ${score}% cosmic match ✨`
      : `@${uname1} vs @${uname2} Compatibility Roast 💀`;
  // The dates belong in the shared URL: without them the person who opens the
  // link runs the plain pairing and sees a different reading than the one they
  // were sent, which is the whole point of sharing it.
  const shareParams = new URLSearchParams({
    uname1: uname1 ?? "",
    uname2: uname2 ?? "",
    language: language ?? "",
  });
  if (dob1) shareParams.set("dob1", dob1);
  if (dob2) shareParams.set("dob2", dob2);
  const pageUrl = `https://instaroasts.com/compatibilityRoast?${shareParams.toString()}`;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
      <Helmet>
        <title>{ogTitle} — InstaRoasts</title>
        <meta name="description" content={`${ogTitle} — ${compatSnippet}...`} />
        <link rel="canonical" href="https://instaroasts.com/compatibilityRoast" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={compatSnippet} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={ogTitle} />
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

      {/* Cosmic Match: score, signs, flags and verdict as real UI. Renders
          nothing at all when the pairing had no birth dates, leaving the
          original plain-markdown layout untouched. */}
      <CosmicVerdict
        score={score}
        sign1={sign1}
        sign2={sign2}
        handle1={uname1 ?? ""}
        handle2={uname2 ?? ""}
        avatar1={userData1?.profile_pic_url ?? null}
        avatar2={userData2?.profile_pic_url ?? null}
        greenFlag={greenFlag}
        redFlag={redFlag}
        verdict={verdict}
      />

      {/* Share bar — same component the single-roast page uses, so Instagram,
          the copy fallback and the share analytics stay in one place */}
      <ShareBar
        title={
          score !== null
            ? `@${uname1} × @${uname2} — ${score}% cosmic match ✨`
            : `@${uname1} vs @${uname2} — the compatibility verdict is in 💀`
        }
        text={compatibilityRoast}
        source={isCosmic ? "cosmic" : "compat"}
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

      {/* The paid reading needs a chart, so it is offered only on a cosmic run.
          A pairing with no birth dates gets the prompt instead: without it the
          page is a dead end that never mentions what was skipped. */}
      {uname1 &&
        uname2 &&
        (isCosmic ? (
          <CosmicDeep
            uname1={uname1}
            uname2={uname2}
            language={language ?? "english"}
            dob1={dob1}
            dob2={dob2}
            score={score}
          />
        ) : (
          <CosmicPrompt
            uname1={uname1}
            uname2={uname2}
            onRun={(newDob1, newDob2) => {
              const params = new URLSearchParams({
                uname1,
                uname2,
                language: language ?? "english",
              });
              if (newDob1) params.set("dob1", newDob1);
              if (newDob2) params.set("dob2", newDob2);
              // Replaces rather than pushes: the dateless version of this
              // pairing is not a place anyone wants the back button to return
              // them to.
              navigate(`/compatibilityRoast?${params.toString()}`, { replace: true });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ))}
    </div>
  );
}
