"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

// Was a framer-motion spring. That pulled the whole animation library into the
// first chunk for one counter in the hero badge — 26KB of JS to parse and run
// before the page would accept a click. A requestAnimationFrame ease looks the
// same at this size and costs nothing on the critical path.
const DURATION_MS = 1400;

// Roughly matches the old spring's settle: fast at first, long tail.
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export default function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
}: {
  value: number;
  direction?: "up" | "down";
  className?: string;
  delay?: number; // delay in seconds
  decimalPlaces?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Format numbers into k, M, B notation
    const formatNumber = (num: number): string => {
      if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
      if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
      if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
      return num.toFixed(decimalPlaces);
    };

    const from = direction === "down" ? value : 0;
    const to = direction === "down" ? 0 : value;

    el.textContent = formatNumber(from);
    if (from === to) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.textContent = formatNumber(to);
      return;
    }

    let frame = 0;
    let startTimer = 0;
    let cancelled = false;

    // Only counts up once it is actually on screen, same as the old useInView.
    const run = () => {
      const started = performance.now();
      const step = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - started) / DURATION_MS);
        const current = from + (to - from) * easeOutExpo(t);
        el.textContent = formatNumber(Number(current.toFixed(decimalPlaces)));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (delay > 0) startTimer = window.setTimeout(run, delay * 1000);
      else run();
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        window.clearTimeout(startTimer);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "0px" }
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(startTimer);
    };
  }, [value, direction, delay, decimalPlaces]);

  return <span className={cn("inline-block tabular-nums tracking-wider", className)} ref={ref} />;
}
