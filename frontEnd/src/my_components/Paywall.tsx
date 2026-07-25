import { useState } from "react";
import { Link } from "react-router-dom";
import {
  createPaymentOrder,
  verifyPayment,
  formatPrice,
  type PaywallInfo,
  type RazorpayCheckoutResult,
} from "@/lib/api";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface PaywallProps {
  info: PaywallInfo;
  // Called once credits are confirmed — the caller retries the original roast.
  onUnlocked: () => void;
}

export function Paywall({ info, onUnlocked }: PaywallProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { amount, currency, credits } = info.price;

  async function handleUnlock() {
    setError(null);

    if (typeof window.Razorpay !== "function") {
      setError("Checkout didn't load — check your connection and refresh.");
      return;
    }

    setBusy(true);
    try {
      const order = await createPaymentOrder();

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "InstaRoasts",
        description: `${order.credits} more roasts`,
        theme: { color: "#f43f5e" },
        handler: async (response: RazorpayCheckoutResult) => {
          try {
            await verifyPayment(response);
            onUnlocked();
          } catch {
            // The webhook is the backstop here: the payment did go through, so
            // credits land server-side even though this confirmation failed.
            setError("Payment went through but we couldn't confirm it yet — refresh in a moment.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          // Fires when the user dismisses Checkout without paying.
          ondismiss: () => setBusy(false),
        },
      });

      checkout.open();
    } catch {
      setError("Couldn't start checkout. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16 text-center space-y-6">
      <div className="text-7xl animate-bounce">🔥</div>

      <h1 className="text-2xl md:text-3xl font-serif font-bold italic text-balance">
        you're out of free roasts
      </h1>

      <p className="text-sm text-muted-foreground max-w-md mx-auto">{info.message}</p>

      <div className="bg-card border-2 border-foreground rounded-3xl p-8 shadow-brutal space-y-5">
        <div className="inline-block bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest rotate-[-2deg]">
          🍿 keep the roasts coming
        </div>

        <div className="space-y-1">
          <div className="text-5xl font-black">{formatPrice(amount, currency)}</div>
          <div className="text-sm text-muted-foreground">
            for {credits} more roast{credits === 1 ? "" : "s"} — no account needed
          </div>
        </div>

        <button
          onClick={handleUnlock}
          disabled={busy}
          className="w-full bg-primary text-primary-foreground border-2 border-foreground rounded-full px-6 py-3 font-bold hover:-translate-y-0.5 transition-all shadow-[3px_3px_0_0_hsl(0_0%_8%)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
        >
          {busy ? "opening checkout…" : `unlock ${credits} more roasts`}
        </button>

        {error && <p className="text-sm text-destructive font-medium">{error}</p>}

        <p className="text-xs text-muted-foreground">
          secure payment via Razorpay · cards, UPI, netbanking
        </p>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold hover:-translate-y-0.5 transition-all shadow-[3px_3px_0_0_hsl(0_0%_8%)]"
      >
        ← back home
      </Link>
    </div>
  );
}
