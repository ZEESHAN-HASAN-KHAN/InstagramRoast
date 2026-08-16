import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * Fires one impression event the first time an element is actually on screen.
 *
 * Every "did people use this?" question is a ratio, and a click event on its
 * own has no denominator — a rating with 40 votes could be a triumph or a
 * disaster depending on whether 60 people saw the widget or 6,000 did. Mounting
 * isn't the same as being seen either, since most of these sections live below
 * the fold, so this waits for real visibility.
 *
 * Fires at most once per mount: a section scrolled past three times is one
 * impression, not three.
 *
 * @param params snapshot of whatever state makes the impression meaningful —
 *               read at fire time, so it reflects what was on screen
 */
export function useSeen<T extends HTMLElement>(
  event: string,
  params: Record<string, string | number | boolean | undefined> = {},
  { enabled = true, ratio = 0.4 }: { enabled?: boolean; ratio?: number } = {}
) {
  const ref = useRef<T>(null);
  const fired = useRef(false);
  // Kept in a ref so a re-render with new params doesn't restart the observer
  // and re-arm the event.
  const latest = useRef(params);
  latest.current = params;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || fired.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || fired.current) return;
        fired.current = true;
        track(event, latest.current);
        observer.disconnect();
      },
      { threshold: ratio }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [event, enabled, ratio]);

  return ref;
}
