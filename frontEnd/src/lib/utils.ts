import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SignJWT } from 'jose';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Handles arrive pasted with an @, wrapped in whitespace, or as a full profile
// URL. Everything downstream (routes, API calls, comparisons) wants the bare
// handle, so normalise once here instead of at each form.
export function cleanHandle(raw: string) {
  let handle = raw.trim();

  const marker = "instagram.com/";
  const start = handle.toLowerCase().indexOf(marker);
  if (start !== -1) {
    handle = handle.substring(start + marker.length);
  }

  // Drops the query string, trailing path segments ("/reels"), and any @ prefix.
  return handle.split(/[?#]/)[0].split("/").filter(Boolean)[0]?.replace(/^@+/, "") ?? "";
}

// create a jwt token with expiration of 1 minute using VITE_APP_TOKEN_SECRET
export async function createToken() {
  const secret = new TextEncoder().encode(import.meta.env.VITE_APP_TOKEN_SECRET); // Encode secret
  const expirationTime = 20; // Expiration time in seconds

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' }) // Set the algorithm for signing
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirationTime) // Set expiration in seconds
    .sign(secret); // Sign the JWT with the secret

  return jwt;
}

// Follower/post counts, Instagram-style: 1.2K, 3.4M. Shared so the profile
// card, the pairing preview and the roast card never disagree on a number.
export function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
