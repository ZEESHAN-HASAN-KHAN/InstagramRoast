import { useEffect, useState } from "react";

// Content-production tools (the daily leaderboard post image) live in the same
// app the public sees, so they need a gate. Not a security boundary — nothing
// behind it is private, it only renders what the page already shows — just a
// switch that keeps operator UI out of a visitor's way.

const STUDIO_KEY = "instaroasts:studio";

function readFlag(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode — the flag just doesn't stick */
  }
}

/**
 * `?studio=1` unlocks operator UI and keeps it unlocked on this device, so the
 * daily post is one tap. `?studio=0` locks it back.
 */
export function useStudioMode() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("studio");
    if (flag === "1") writeFlag(STUDIO_KEY, "1");
    else if (flag === "0") writeFlag(STUDIO_KEY, null);
    setOn(readFlag(STUDIO_KEY) === "1");
  }, []);

  return on;
}
