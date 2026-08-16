import { createToken } from "@/lib/utils";

// Cached public facts about the profile behind the wall — lets the paywall show
// what's being unlocked. Null when we've never scraped this profile (the
// backend never scrapes for an unpaid request).
export interface PaywallPreviewProfile {
  username: string;
  full_name: string;
  profile_pic_url: string;
  follower: number;
  following: number;
  post: number;
  biography: string;
}

export interface PaywallInfo {
  paywall: true;
  message: string;
  // Set on the re-roast variant, which can only be paid with paid credits.
  reroll?: boolean;
  preview?: {
    username: string;
    // Present for compatibility roasts — the second handle of the pair.
    username2?: string;
    profile: PaywallPreviewProfile | null;
  };
  credits: {
    freeUsed: number;
    freeLimit: number;
    paidCredits: number;
  };
  price: {
    amount: number;
    currency: string;
    credits: number;
  };
}

// GET /payment/credits — balance check that never spends anything. The
// switched-off regions report unlimited instead of 403ing.
export interface CreditsInfo {
  monetizationEnabled: boolean;
  unlimited?: boolean;
  freeUsed?: number;
  freeLimit?: number;
  paidCredits?: number;
  price?: { amount: number; currency: string; credits: number };
}

// The enqueue endpoints answer one of three ways: a fully cached result
// (answered synchronously), a queued job to open an SSE stream against, or the
// paywall when the visitor has no roasts left to spend.
export type EnqueueResponse<TResult> =
  | { done: true; result: TResult }
  | { done: false; jobId: string; streamToken: string }
  | PaywallInfo;

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  credits: number;
  keyId: string;
}

export const apiUrl = import.meta.env.VITE_APP_BASE_URL;

// `credentials: "include"` on every call — the anonymous `roast_session` cookie
// is what the backend counts roasts against, and it won't be sent cross-origin
// without it.
async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await createToken();
  return fetch(apiUrl + path, {
    ...init,
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

// Enqueues a roast. A 402 isn't an error here — it's the "you're out of roasts"
// answer, returned as data so the hook can show the paywall instead of the
// generic failure screen.
export async function enqueueRoast<TResult>(
  path: string,
  body: unknown
): Promise<EnqueueResponse<TResult>> {
  const response = await authedFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (response.status === 402) {
    return (await response.json()) as PaywallInfo;
  }
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return (await response.json()) as EnqueueResponse<TResult>;
}

export async function getCredits(): Promise<CreditsInfo> {
  const response = await authedFetch("/api/v1/payment/credits");
  if (!response.ok) throw new Error("Could not load credit balance");
  return response.json();
}

export async function createPaymentOrder(): Promise<CreateOrderResponse> {
  const response = await authedFetch("/api/v1/payment/createOrder", { method: "POST" });
  if (!response.ok) throw new Error("Could not start checkout");
  return response.json();
}

export interface RazorpayCheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function verifyPayment(payload: RazorpayCheckoutResult) {
  const response = await authedFetch("/api/v1/payment/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("We couldn't confirm that payment");
  return response.json() as Promise<{ success: boolean; paidCredits: number }>;
}

// --- PayPal (international visitors only — the backend refuses INR here) ---

export interface PaypalConfig {
  clientId: string;
  currency: string;
}

export async function getPaypalConfig(): Promise<PaypalConfig> {
  const response = await authedFetch("/api/v1/payment/paypal/config");
  if (!response.ok) throw new Error("PayPal is not available");
  return response.json();
}

export async function createPaypalOrder(): Promise<{ orderId: string }> {
  const response = await authedFetch("/api/v1/payment/paypal/createOrder", { method: "POST" });
  if (!response.ok) throw new Error("Could not start checkout");
  return response.json();
}

export async function capturePaypalOrder(orderId: string) {
  const response = await authedFetch("/api/v1/payment/paypal/capture", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
  if (!response.ok) throw new Error("We couldn't confirm that payment");
  return response.json() as Promise<{ success: boolean; paidCredits: number }>;
}

// --- engagement: ratings, discovery feed, leaderboards -----------------------

export interface Percentile {
  topPercent: number;
  outOf: number;
}

export interface RatingStats {
  average: number | null;
  count: number;
  yourRating: number | null;
  global: Percentile | null;
  // Standing in the tightest area the backend could place this visitor in.
  // `localLabel` names that area ("Kolkata"); both are null when it couldn't.
  local: Percentile | null;
  localLabel: string | null;
}

// The tier of this profile's most recently *revealed* card, or null when
// nobody has flipped one yet. Never set for a face-down card — the backend
// withholds it so the site can't spoil a pull that hasn't happened. Drives the
// aura in lib/cardAura.ts.
export interface RoastedProfile {
  username: string;
  full_name: string;
  profile_pic_url: string | null;
  created_at: string;
  card_tier?: string | null;
}

export interface LeaderboardEntry {
  username: string;
  full_name: string;
  profile_pic_url: string | null;
  roast_count?: number;
  average?: number;
  votes?: number;
  card_tier?: string | null;
}

// Which geographic scope actually produced these rows. The backend widens from
// city outward until it has enough to show, so this can be broader than asked
// for — label what came back, not what was requested.
export type FeedScope = "city" | "region" | "country" | "global";

export interface RecentFeed {
  scope: FeedScope;
  label: string | null;
  roasts: RoastedProfile[];
}

export interface LeaderboardSection {
  scope: FeedScope;
  label: string | null;
  entries: LeaderboardEntry[];
}

// "day" is the rolling 24h window, "all" the permanent record. Unlike scope,
// this is never widened server-side — a range is answered as asked.
export type LeaderboardRange = "day" | "all";

export interface Leaderboards {
  range: LeaderboardRange;
  mostRoasted: LeaderboardSection;
  topRated: LeaderboardSection;
}

export interface VisitorScope {
  country: string | null;
  region: string | null;
  city: string | null;
}

export async function getRatingStats(username: string): Promise<RatingStats> {
  const response = await authedFetch(`/api/v1/profiles/${encodeURIComponent(username)}/rating`);
  if (!response.ok) throw new Error("Could not load ratings");
  return response.json();
}

// How many of each card tier have ever been pulled, site-wide. This is the
// observed number, not the design probability — "13 of these exist" is what
// makes a rare pull worth screenshotting.
export interface CardCounts {
  counts: Partial<Record<string, number>>;
  total: number;
}

export async function getCardCounts(): Promise<CardCounts> {
  const response = await authedFetch("/api/v1/cards/counts");
  if (!response.ok) throw new Error("Could not load card counts");
  return response.json();
}

// Whether this visitor has already flipped the card for the roast they're
// looking at. Server-side and keyed to the roast itself, so it survives a
// reload, a different tab, and a cleared browser cache — and a re-roast, which
// mints a different card, correctly comes back unrevealed.
export interface CardState {
  revealed: boolean;
  tier: string | null;
  serial: string | null;
}

export async function getCardState(username: string, language: string): Promise<CardState> {
  const response = await authedFetch(
    `/api/v1/profiles/${encodeURIComponent(username)}/card?language=${encodeURIComponent(language)}`
  );
  if (!response.ok) throw new Error("Could not load card state");
  return response.json();
}

export async function revealCard(username: string, language: string): Promise<void> {
  const response = await authedFetch(
    `/api/v1/profiles/${encodeURIComponent(username)}/card/reveal`,
    { method: "POST", body: JSON.stringify({ language }) }
  );
  if (!response.ok) throw new Error("Could not save the reveal");
}

export async function rateProfile(username: string, rating: number): Promise<RatingStats> {
  const response = await authedFetch(`/api/v1/profiles/${encodeURIComponent(username)}/rating`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
  if (!response.ok) throw new Error("Could not save your vote");
  return response.json();
}

// `strict` asks for exactly this scope. Without it the backend widens outward
// until it has enough rows to be worth showing, and reports which scope actually
// answered — right for the ticker, wrong for a tab the visitor chose.
export async function getRecentFeed(
  scope: FeedScope = "global",
  { strict = false, limit }: { strict?: boolean; limit?: number } = {}
): Promise<RecentFeed> {
  const params = new URLSearchParams({ scope });
  if (strict) params.set("strict", "1");
  if (limit) params.set("limit", String(limit));

  const response = await authedFetch(`/api/v1/feed/recent?${params}`);
  if (!response.ok) throw new Error("Could not load the feed");
  return response.json();
}

export async function getLeaderboard(
  scope: FeedScope = "global",
  range: LeaderboardRange = "day"
): Promise<Leaderboards> {
  const response = await authedFetch(`/api/v1/leaderboard?scope=${scope}&range=${range}`);
  if (!response.ok) throw new Error("Could not load the leaderboard");
  return response.json();
}

export async function getVisitorScope(): Promise<VisitorScope> {
  const response = await authedFetch("/api/v1/visitorScope");
  if (!response.ok) throw new Error("Could not resolve your location");
  return response.json();
}

// Formats a smallest-unit amount (paise/cents) for display.
export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}
