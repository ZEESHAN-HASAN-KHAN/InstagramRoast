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

// Formats a smallest-unit amount (paise/cents) for display.
export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}
