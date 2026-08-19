// Gateway SDK plumbing, shared by every surface that can open a checkout — the
// out-of-credits paywall and the First Mint claim panel. Both gateways load
// once per page regardless of how many places offer to charge you.

export interface PaypalButtonsInstance {
  render: (container: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
    paypal?: {
      Buttons: (options: Record<string, unknown>) => PaypalButtonsInstance;
    };
  }
}

// Loads the PayPal JS SDK once and dedupes concurrent callers — a second mount
// (e.g. StrictMode, or a claim panel opening below a paywall) reuses the same
// script tag instead of double-injecting.
let paypalSdkPromise: Promise<void> | null = null;

export function loadPaypalSdk(clientId: string, currency: string): Promise<void> {
  if (window.paypal) return Promise.resolve();
  if (!paypalSdkPromise) {
    paypalSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        clientId
      )}&currency=${encodeURIComponent(currency)}&intent=capture`;
      script.onload = () => resolve();
      script.onerror = () => {
        paypalSdkPromise = null;
        reject(new Error("PayPal SDK failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return paypalSdkPromise;
}

// Razorpay's checkout.js used to be a tag in index.html. Even marked async it
// still competed with the app's own bundle for bandwidth and for the main
// thread during boot, on every page, for a script the overwhelming majority of
// visitors never reach. It is injected from here instead: on idle after the app
// has started (see prefetchRazorpay) and, failing that, at the moment someone
// actually taps a pay button.
const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let razorpaySdkPromise: Promise<void> | null = null;

export function loadRazorpaySdk(): Promise<void> {
  if (typeof window.Razorpay === "function") return Promise.resolve();
  if (!razorpaySdkPromise) {
    razorpaySdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Cleared so a later tap gets a fresh attempt rather than inheriting a
        // failure from a moment of bad signal.
        razorpaySdkPromise = null;
        reject(new Error("Razorpay checkout failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return razorpaySdkPromise;
}

// Warms the SDK without blocking anything. Fire-and-forget: a failure here is
// retried by waitForRazorpay when the button is actually pressed.
export function prefetchRazorpay() {
  loadRazorpaySdk().catch(() => {});
}

// On a phone over mobile data the script routinely isn't there yet when someone
// taps, and failing instantly turned a slow connection into a dead paywall.
// Wait it out for a few seconds first — the button already shows "opening
// checkout…", so the wait reads as the checkout loading, which is exactly what
// it is.
const RAZORPAY_WAIT_MS = 6000;

export function waitForRazorpay(timeoutMs = RAZORPAY_WAIT_MS): Promise<boolean> {
  if (typeof window.Razorpay === "function") return Promise.resolve(true);
  prefetchRazorpay();
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = window.setInterval(() => {
      if (typeof window.Razorpay === "function") {
        window.clearInterval(tick);
        resolve(true);
      } else if (Date.now() - started >= timeoutMs) {
        window.clearInterval(tick);
        resolve(false);
      }
    }, 150);
  });
}
