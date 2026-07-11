import { useEffect, useRef, useState } from "react";

// Backend stages can flash by faster than a human can register (a cached
// profile + groq roast finishes in ~1s), so the raw stage index isn't shown
// directly. This paces the displayed step: it only ever advances, one step at
// a time, holding each for at least `stepMs` — the loading screen always ticks
// through every beat even when the server skipped past them instantly.
// `resetKey` restarts the ladder from 0 (e.g. roasting a different username
// without the component remounting).
export function usePacedIndex(targetIndex: number, resetKey: unknown, stepMs = 650): number {
  const [displayed, setDisplayed] = useState(0);
  const lastResetKey = useRef(resetKey);

  if (lastResetKey.current !== resetKey) {
    lastResetKey.current = resetKey;
    setDisplayed(0);
  }

  useEffect(() => {
    if (displayed >= targetIndex) return;
    const timer = setTimeout(() => setDisplayed((d) => d + 1), stepMs);
    return () => clearTimeout(timer);
  }, [displayed, targetIndex, stepMs]);

  return displayed;
}
