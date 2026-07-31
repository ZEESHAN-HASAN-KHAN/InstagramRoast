import { createToken } from "@/lib/utils";

export interface PaywallInfo {
  paywall: true;
  message: string;
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

export interface RoastedProfile {
  username: string;
  full_name: string;
  profile_pic_url: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  username: string;
  full_name: string;
  profile_pic_url: string | null;
  roast_count?: number;
  average?: number;
  votes?: number;
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

export interface Leaderboards {
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

export async function getLeaderboard(scope: FeedScope = "global"): Promise<Leaderboards> {
  const response = await authedFetch(`/api/v1/leaderboard?scope=${scope}`);
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
