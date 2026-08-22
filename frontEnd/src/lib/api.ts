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
  // Set on the Cosmic Match deep reading, which is also paid-credits-only.
  deep?: boolean;
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

// Both gateways confirm through the same pair of routes, and the order row
// itself remembers what it was buying. `mint` is non-null only when the order
// was a First Mint claim; `paidCredits` reports the session balance either way.
export interface PaymentConfirmation {
  success: boolean;
  paidCredits: number;
  mint: MintFulfilment | null;
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
  return response.json() as Promise<PaymentConfirmation>;
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
  return response.json() as Promise<PaymentConfirmation>;
}

// --- First Mint claims -------------------------------------------------------

// A claim confirmation. Present on a verify/capture response only when the
// order was a mint claim; credit top-ups get null.
export interface MintFulfilment {
  mintNo: number;
  claimedBy: string;
  username: string;
}

export interface CreateMintOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  mintNo: number;
  handle: string;
  /** Razorpay only. */
  keyId?: string;
}

// The backend refuses these with a 409 when the mint has just been claimed or
// is held by another checkout, and a 400 when the handle isn't a real account.
// Those messages are written to be shown to the buyer verbatim, so they're
// carried through rather than flattened into a generic failure.
// `responseId` pins the claim to one specific card. Omitting it means "whatever
// is newest for this handle", which is only right on the live roast page — an
// archived card must always name itself, or the claim would silently land on a
// different, later card than the one being looked at.
export interface MintClaimTarget {
  username: string;
  language: string;
  handle: string;
  responseId?: number;
}

async function mintOrder(path: string, target: MintClaimTarget) {
  const response = await authedFetch(path, {
    method: "POST",
    body: JSON.stringify(target),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "Could not start checkout");
  }
  return response.json() as Promise<CreateMintOrderResponse>;
}

export function createMintOrder(target: MintClaimTarget) {
  return mintOrder("/api/v1/payment/mint/createOrder", target);
}

export function createMintPaypalOrder(target: MintClaimTarget) {
  return mintOrder("/api/v1/payment/mint/paypal/createOrder", target);
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
  /** Card board only: every distinct tier this profile has had revealed. */
  tiers?: string[];
  /** How many of those there are — the collection-breadth tiebreak. */
  variety?: number;
  /** Total revealed cards, re-rolls included. */
  cards?: number;
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
  /** Rarest card pulled, breadth of collection as the tiebreak. */
  topCards: LeaderboardSection;
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
/**
 * A card's permanent mint number within its profile, and whether the right to
 * put a name on it is still for sale.
 *
 * `no` counts from 1 in the order the profile was actually roasted, so #1 is
 * the first roast of that handle that ever existed. `claimedBy` non-null means
 * someone has paid to print their handle on this card and nobody else can.
 */
export interface MintState {
  no: number;
  total: number;
  claimedBy: string | null;
  claimedAt: string | null;
  /** Someone else has checkout open on this mint right now. */
  heldByOther: boolean;
  claimable: boolean;
  /** Display copy of the price. The order route prices it again server-side. */
  price: { amount: number; currency: string } | null;
}

export interface CardState {
  revealed: boolean;
  tier: string | null;
  serial: string | null;
  /** Which roast this card belongs to — a claim is pinned to it, not to "newest". */
  responseId: number;
  mint: MintState | null;
}

export async function getCardState(username: string, language: string): Promise<CardState> {
  const response = await authedFetch(
    `/api/v1/profiles/${encodeURIComponent(username)}/card?language=${encodeURIComponent(language)}`
  );
  if (!response.ok) throw new Error("Could not load card state");
  return response.json();
}

// Every card this profile has had flipped face-up — the thing the leaderboard
// is counting when it credits someone with "2 cards · 2 tiers". Face-down cards
// never appear, so this can be shown to anyone.
export interface RevealedCard {
  /** The roast this card was minted from — what makes the card clickable. */
  id: number;
  tier: string;
  serial: string | null;
  language: string | null;
  /**
   * This card's permanent position in the profile's history, and who owns it.
   * Null mint_no only for a card whose mint row went missing; it heals on the
   * next view of that card.
   */
  mint_no: number | null;
  claimed_by: string | null;
  pulled_at: string;
}

export interface CardCollection {
  cards: RevealedCard[];
  total: number;
  tiers: number;
}

export async function getCardCollection(username: string): Promise<CardCollection> {
  const response = await authedFetch(
    `/api/v1/profiles/${encodeURIComponent(username)}/cards`
  );
  if (!response.ok) throw new Error("Could not load the card collection");
  return response.json();
}

// A specific roast by id, including ones a re-roll has superseded. The live
// roast route only ever serves the newest per language, so this is the only way
// back to an older card's roast.
export interface ArchivedRoast {
  insta_data: {
    profile_pic_url: string;
    username: string;
    full_name: string;
    follower: number;
    following: number;
    biography: string;
    post: number;
  };
  data: string;
  language: string;
  /** False when a re-roll has since replaced it as the live roast. */
  isLatest: boolean;
  card: { tier: string | null; serial: string | null };
  /** This roast's own id — what a claim on this specific card is pinned to. */
  responseId: number;
  /**
   * Resolved against THIS roast rather than the profile's newest. Archived
   * cards are where the low mint numbers live: the moment a handle is roasted
   * twice, its #1 is only reachable here.
   */
  mint: MintState | null;
  createdAt: string;
}

export async function getArchivedRoast(username: string, id: number): Promise<ArchivedRoast> {
  const response = await authedFetch(
    `/api/v1/profiles/${encodeURIComponent(username)}/roasts/${id}`
  );
  if (!response.ok) throw new Error("Could not load that roast");
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

// ── Cosmic Match: the paid deep reading ───────────────────────────────────
//
// Plain request/response rather than the job-and-stream dance the roasts use.
// Both profiles are already scraped by the time this button exists, so there is
// nothing to scrape and only one model call to wait for — a queue hop and an
// SSE connection would be machinery around a spinner.

export interface DeepSection {
  key: string;
  title: string;
  icon: string;
  body: string;
  // Both optional: readings bought before these fields existed are cached in
  // the database and replay without them, so the UI has to render fine either
  // way rather than assuming every section carries decoration.
  planet?: string;
  tone?: "blessed" | "tense" | "cursed";
}

export interface DeepReading {
  sections: DeepSection[];
}

export type DeepReadingResult =
  | { reading: DeepReading; cached: boolean }
  | PaywallInfo;

export async function fetchDeepReading(body: {
  uname1: string;
  uname2: string;
  language: string;
  dob1: string | null;
  dob2: string | null;
}): Promise<DeepReadingResult> {
  const response = await authedFetch("/api/v1/cosmicMatch/deep", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (response.status === 402) {
    return (await response.json()) as PaywallInfo;
  }
  if (!response.ok) {
    // The server sends a human-readable `message` for the cases worth
    // explaining (unreadable model output, match not run yet); anything else
    // falls back to something that is not a status code.
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.message ?? "The stars are busy. Try again in a moment.");
  }

  const data = (await response.json()) as { reading: DeepReading; cached?: boolean };
  return { reading: data.reading, cached: Boolean(data.cached) };
}
