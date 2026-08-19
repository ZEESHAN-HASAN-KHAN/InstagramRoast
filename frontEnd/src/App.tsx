"use client";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Hero } from "./my_components/Hero";
import { Navbar } from "./my_components/Navbar";
import { ModeToggle } from "@/components/ui/ModeToggle";
import React from "react";
import { LazySection } from "./my_components/LazySection";
import { SiteFooter } from "./my_components/SiteFooter";
import { trackPageView } from "./lib/analytics";

// Only the navbar, the hero and the footer are in the first bundle. Everything
// else is a separate chunk fetched either when its route is entered or when its
// section is about to scroll into view — the homepage used to ship and execute
// the roast screen, the leaderboard and the legal pages before it would accept
// a single click.
const About = React.lazy(() => import("./my_components/About").then((m) => ({ default: m.About })));
const Faq = React.lazy(() => import("./my_components/Faq").then((m) => ({ default: m.Faq })));
const Roast = React.lazy(() => import("./my_components/Roast").then((m) => ({ default: m.Roast })));
const RoastToast = React.lazy(() =>
  import("./my_components/RoastToast").then((m) => ({ default: m.RoastToast }))
);
const NearbyRoasts = React.lazy(() =>
  import("./my_components/NearbyRoasts").then((m) => ({ default: m.NearbyRoasts }))
);
const Leaderboard = React.lazy(() =>
  import("./my_components/Leaderboard").then((m) => ({ default: m.Leaderboard }))
);
const LeaderboardPage = React.lazy(() =>
  import("./my_components/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage }))
);
const Compatibility = React.lazy(() =>
  import("./my_components/Compatibility").then((m) => ({ default: m.Compatibility }))
);
const CompatiblityRoast = React.lazy(() =>
  import("./my_components/CompatibilityRoast").then((m) => ({ default: m.CompatiblityRoast }))
);
const Terms = React.lazy(() => import("./my_components/Terms").then((m) => ({ default: m.Terms })));
const Privacy = React.lazy(() =>
  import("./my_components/Privacy").then((m) => ({ default: m.Privacy }))
);
const RefundPolicy = React.lazy(() =>
  import("./my_components/RefundPolicy").then((m) => ({ default: m.RefundPolicy }))
);

// The roast screen is where the hero's one button goes, so its chunk is pulled
// down as soon as the browser is idle. By the time anyone has typed a handle it
// is already cached and the navigation is instant — lazy loading a route should
// not turn a click into a network wait.
function usePrefetchRoastRoute() {
  React.useEffect(() => {
    const load = () => {
      import("./my_components/Roast");
    };
    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (idle) {
      const id = idle(load, { timeout: 3000 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(load, 2000);
    return () => window.clearTimeout(timer);
  }, []);
}

// gtag only sees the first full page load; every client-side navigation after
// that has to be reported by hand or the funnel data stops at the front door.
function RouteTracker() {
  const { pathname, search } = useLocation();
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false; // initial load already tracked by gtag config
      return;
    }
    trackPageView(pathname + search);
  }, [pathname, search]);
  return null;
}

// A client-side route change keeps the old scroll offset, so following a link
// from halfway down one page drops you halfway down the next one. Hash links
// are left alone — those are asking for a specific spot on purpose.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  React.useEffect(() => {
    if (hash) return;
    // "instant" beats the global `html { scroll-behavior: smooth }`, which would
    // otherwise animate a full-page scroll on every navigation.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}

const LEGAL_PATHS = ["/terms", "/privacy", "/refund-policy"];

const RedirectToUsername = () => {
  const navigate = useNavigate();
  const handleRedirect = () => {
    const path = window.location.pathname;
    if (path && path !== "/") {
      let username = path.substring(1);
      if (username.includes("instagram.com")) {
        const instagramBase = "instagram.com/";
        const startIndex = username.indexOf(instagramBase);
        if (startIndex !== -1) {
          const extractedPart = username.substring(startIndex + instagramBase.length);
          const usernameArr = extractedPart.split("/").filter(Boolean);
          username = usernameArr[0];
        }
        navigate(`/${username}?language=english`);
      }
    }
  };

  React.useEffect(() => {
    handleRedirect();
  }, []);

  return null;
};

// Deliberately blank rather than a spinner: these chunks resolve in a few tens
// of milliseconds off cache, and a flashing loader reads as jank.
function RouteFallback() {
  return <div className="min-h-[60vh]" />;
}

function Home() {
  return (
    <>
      <Hero />
      {/* Sits at the top of the page but paints as a fixed overlay, so it is
          given a generous margin: it should arrive right after first paint,
          just not inside the same task. */}
      <LazySection minHeight={0} rootMargin="600px">
        <RoastToast />
      </LazySection>
      <LazySection minHeight={520} anchorIds={["recent-roasts"]}>
        <NearbyRoasts />
      </LazySection>
      <LazySection minHeight={640} anchorIds={["leaderboard"]}>
        <Leaderboard />
      </LazySection>
      <LazySection minHeight={420}>
        <Compatibility />
      </LazySection>
    </>
  );
}

function AppLayout() {
  const { pathname } = useLocation();
  const isLegalPage = LEGAL_PATHS.includes(pathname);
  usePrefetchRoastRoute();

  return (
    <div className="min-h-screen flex flex-col">
      <RouteTracker />
      <ScrollToTop />
      <RedirectToUsername />
      <Navbar />

      <main className="flex-1">
        <React.Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/compatibilityRoast" element={<CompatiblityRoast />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/:username" element={<Roast />} />
          </Routes>
        </React.Suspense>

        {!isLegalPage && (
          <>
            {/* About owns #features and #about, Faq owns #faq — the navbar
                scrolls to those by id. */}
            <LazySection minHeight={600} anchorIds={["features", "about"]}>
              <About />
            </LazySection>
            <LazySection minHeight={500} anchorIds={["faq"]}>
              <Faq />
            </LazySection>
          </>
        )}
      </main>

      <SiteFooter />

      {/* Mobile floating controls. The bottom offset clears the iPhone home
          indicator — index.html sets viewport-fit=cover, so the inset is real. */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 opacity-80 md:hidden">
        <ModeToggle />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ThemeProvider>
  );
}
