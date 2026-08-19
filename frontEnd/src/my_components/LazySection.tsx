import React from "react";

/**
 * Mounts its children only once they are about to scroll into view.
 *
 * The homepage used to build Hero, the live feed, the leaderboard, the
 * compatibility pitch, the features grid and the FAQ in a single synchronous
 * render. That is one long task on the main thread, and while it runs the
 * browser cannot dispatch a click — which is exactly what "the first taps do
 * nothing" felt like. Everything below the fold is deferred here instead, so
 * first paint only pays for what is actually on screen.
 *
 * `minHeight` reserves the space the section will take so nothing under the
 * cursor jumps when it finally mounts.
 */
export function LazySection({
  children,
  minHeight = 400,
  rootMargin = "300px",
  anchorIds,
}: {
  children: React.ReactNode;
  minHeight?: number;
  rootMargin?: string;
  /**
   * Ids the section owns once it is mounted. The navbar scrolls by
   * `getElementById`, so while the section is still a placeholder those ids
   * have to exist somewhere or "features" and "faq" become dead links — the
   * exact symptom this whole change is meant to remove. Stand-ins are rendered
   * until the real section takes the ids over.
   */
  anchorIds?: string[];
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (very old browsers): show it rather than hide the
    // section forever.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, rootMargin]);

  // The children are React.lazy chunks, so they need a boundary of their own —
  // the route-level one would blank the whole page while a below-fold section
  // downloads.
  return (
    <div ref={ref} style={shown ? undefined : { minHeight }}>
      {shown ? (
        <React.Suspense fallback={<div style={{ minHeight }} />}>{children}</React.Suspense>
      ) : (
        anchorIds?.map((id) => <div key={id} id={id} />)
      )}
    </div>
  );
}
