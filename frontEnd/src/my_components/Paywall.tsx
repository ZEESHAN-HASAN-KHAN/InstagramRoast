import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  capturePaypalOrder,
  createPaymentOrder,
  createPaypalOrder,
  getPaypalConfig,
  verifyPayment,
  formatPrice,
  type PaywallInfo,
  type PaywallPreviewProfile,
  type RazorpayCheckoutResult,
} from "@/lib/api";
import {
  loadPaypalSdk,
  prefetchRazorpay,
  waitForRazorpay,
  type PaypalButtonsInstance,
} from "@/lib/checkout";
import { ProfileCard } from "./ProfileCard";
import { formatCount } from "@/lib/utils";
import { track, trackPageView } from "@/lib/analytics";

interface PaywallProps {
  info: PaywallInfo;
  // Called once credits are confirmed — the caller retries the original roast.
  onUnlocked: () => void;
  /**
   * What is being bought. Threaded onto every event this screen emits,
   * including the GA4 ecommerce ones, because `purchase` and `begin_checkout`
   * are otherwise identical whether someone bought a roast credit or a Cosmic
   * Match deep reading. Without it revenue cannot be attributed to a product,
   * which is the one question the funnel exists to answer.
   */
  surface?: "roast" | "compat" | "cosmic_deep";
}

// Both faces of a pairing, side by side. A compatibility wall that renders the
// single-profile ProfileCard shows one of the two people being compared, which
// reads as the wrong screen — and the badge on that card ("target locked")
// belongs to the single roast.
function PairPreview({
  handle1,
  handle2,
  profile1,
  profile2,
}: {
  handle1: string;
  handle2: string;
  profile1: PaywallPreviewProfile | null;
  profile2: PaywallPreviewProfile | null;
}) {
  const face = (profile: PaywallPreviewProfile | null, handle: string) => (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-2 text-center">
      <div className="size-20 md:size-24 rounded-full p-1 bg-gradient-to-tr from-primary via-pink-400 to-accent shrink-0">
        {profile ? (
          <img
            src={profile.profile_pic_url}
            alt={`@${handle} avatar`}
            className="size-full rounded-full object-cover bg-background"
          />
        ) : (
          <div className="size-full rounded-full bg-background flex items-center justify-center text-2xl">
            👤
          </div>
        )}
      </div>
      <div className="w-full min-w-0">
        <p className="font-serif italic font-bold truncate">
          {profile?.full_name || `@${handle}`}
        </p>
        <p className="text-xs text-muted-foreground truncate">@{handle}</p>
      </div>
      {profile && (
        <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
          👀 {formatCount(profile.follower)} followers
        </p>
      )}
    </div>
  );

  return (
    <div className="relative bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[0.5deg]">
      <div className="absolute -top-3 -right-3 bg-accent text-accent-foreground text-xs font-black uppercase px-3 py-1.5 rounded-full rotate-[8deg] shadow-md z-10">
        💘 pair locked
      </div>
      <div className="flex items-center gap-3 md:gap-6">
        {face(profile1, handle1)}
        <div className="shrink-0 size-11 md:size-12 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-xs shadow-brutal">
          VS
        </div>
        {face(profile2, handle2)}
      </div>
    </div>
  );
}

export function Paywall({ info, onUnlocked, surface = "roast" }: PaywallProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalContainerRef = useRef<HTMLDivElement>(null);

  const { amount, currency, credits } = info.price;

  // India pays through Razorpay (UPI/cards/netbanking); everyone else through
  // PayPal — RBI bars PayPal from processing domestic Indian payments, so the
  // split mirrors the backend's requireInternational guard.
  const usePaypal = currency !== "INR";

  const gateway = usePaypal ? "paypal" : "razorpay";
  const value = amount / 100;

  // GA4's Monetization reports and the standard funnel explorations key off the
  // `items` array, not off `value` alone. Without it the revenue lands but no
  // report can break it down, so every ecommerce event below carries it.
  const items = [
    {
      // item_id stays keyed on the pack so historical rows keep aggregating,
      // but the name says which screen sold it — "roast credits" on a Cosmic
      // Match wall is the wrong product in every report that shows names.
      item_id: `credits_${credits}`,
      item_name: info.deep
        ? `${credits} credits · cosmic match reading`
        : `${credits} roast credits`,
      item_category: "credits",
      price: value,
      quantity: 1,
    },
  ];

  // Warm the checkout SDK the moment the wall is on screen. It is no longer a
  // tag in index.html — that cost every visitor ~200ms of script execution
  // during boot for a script only buyers reach — so this is where it gets
  // fetched, well before anyone reaches for the button.
  useEffect(() => {
    prefetchRazorpay();
  }, []);

  // Top of the conversion funnel — everything downstream (checkout_opened,
  // purchase, paywall_abandoned) is measured against this event.
  useEffect(() => {
    track("paywall_shown", {
      surface,
      variant: info.deep ? "deep" : info.reroll ? "reroll" : "out_of_credits",
      has_preview: !!info.preview?.profile,
      gateway,
      currency,
      value,
    });

    // The paywall replaces the roast in place, without a route change, so GA
    // otherwise never records anyone arriving at it — it shows up in Events but
    // is missing from "Pages and screens" and from any path-based funnel. This
    // is the "how many people reached the payments page" number.
    trackPageView("/paywall", "Paywall — InstaRoasts");

    // GA4's own recommended name for the same moment. Sent alongside the custom
    // event so the built-in monetization funnel works without giving up the
    // richer paywall_shown params.
    track("view_item", { surface, currency, value, items });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!usePaypal) return;

    let cancelled = false;
    let buttons: PaypalButtonsInstance | null = null;

    (async () => {
      try {
        const config = await getPaypalConfig();
        await loadPaypalSdk(config.clientId, config.currency);
        if (cancelled || !window.paypal || !paypalContainerRef.current) return;

        buttons = window.paypal.Buttons({
          style: { layout: "vertical", shape: "pill", label: "pay" },
          createOrder: async () => {
            setError(null);
            track("checkout_opened", { surface, gateway: "paypal" });
            track("begin_checkout", { surface, gateway: "paypal", currency, value, items });
            const order = await createPaypalOrder();
            return order.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            setBusy(true);
            try {
              await capturePaypalOrder(data.orderID);
              track("purchase", {
                surface,
                transaction_id: data.orderID,
                gateway: "paypal",
                currency,
                value,
                items,
              });
              onUnlocked();
            } catch {
              // The webhook is the backstop: the capture may have landed
              // server-side even though this confirmation call failed.
              track("purchase_failed", { surface, gateway: "paypal", stage: "capture" });
              setError("Payment went through but we couldn't confirm it yet — refresh in a moment.");
            } finally {
              setBusy(false);
            }
          },
          onError: () => {
            setBusy(false);
            track("purchase_failed", { surface, gateway: "paypal", stage: "paypal_error" });
            setError("Couldn't start checkout. Try again in a moment.");
          },
          onCancel: () => {
            setBusy(false);
            track("checkout_dismissed", { surface, gateway: "paypal" });
          },
        });

        await buttons.render(paypalContainerRef.current);
        if (!cancelled) setPaypalReady(true);
      } catch {
        if (!cancelled) {
          track("purchase_failed", { surface, gateway: "paypal", stage: "sdk_load" });
          setError("Checkout didn't load — check your connection and refresh.");
        }
      }
    })();

    return () => {
      cancelled = true;
      buttons?.close().catch(() => {});
    };
    // onUnlocked is stable for the lifetime of the paywall screen; re-running
    // this effect would tear down and re-render the PayPal buttons mid-checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePaypal]);

  async function handleRazorpayUnlock() {
    setError(null);
    setBusy(true);

    if (!(await waitForRazorpay())) {
      track("purchase_failed", { surface, gateway: "razorpay", stage: "sdk_load" });
      setError("Checkout didn't load — check your connection and refresh.");
      setBusy(false);
      return;
    }

    try {
      const order = await createPaymentOrder();

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "InstaRoasts",
        description: info.deep ? "Cosmic Match full reading" : `${order.credits} more roasts`,
        theme: { color: "#f43f5e" },
        handler: async (response: RazorpayCheckoutResult) => {
          try {
            await verifyPayment(response);
            track("purchase", {
              surface,
              transaction_id: order.orderId,
              gateway: "razorpay",
              currency: order.currency,
              value: order.amount / 100,
              // Priced off the order the server actually created, not the
              // quote the paywall rendered with, so a mid-session price change
              // can't report revenue that was never charged.
              items: [{ ...items[0], price: order.amount / 100 }],
            });
            onUnlocked();
          } catch {
            // The webhook is the backstop here: the payment did go through, so
            // credits land server-side even though this confirmation failed.
            track("purchase_failed", { surface, gateway: "razorpay", stage: "verify" });
            setError("Payment went through but we couldn't confirm it yet — refresh in a moment.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          // Fires when the user dismisses Checkout without paying.
          ondismiss: () => {
            setBusy(false);
            track("checkout_dismissed", { surface, gateway: "razorpay" });
          },
        },
      });

      track("checkout_opened", { surface, gateway: "razorpay" });
      track("begin_checkout", {
        surface,
        gateway: "razorpay",
        currency: order.currency,
        value: order.amount / 100,
        items: [{ ...items[0], price: order.amount / 100 }],
      });
      checkout.open();
    } catch {
      track("purchase_failed", { surface, gateway: "razorpay", stage: "create_order" });
      setError("Couldn't start checkout. Try again in a moment.");
      setBusy(false);
    }
  }

  const preview = info.preview;
  const targetHandle = preview?.username ?? null;
  const isPair = !!preview?.username2;
  const perRoast = credits > 1 ? formatPrice(Math.round(amount / credits), currency) : null;
  const { freeUsed, freeLimit } = info.credits;

  const headline = info.deep ? (
    targetHandle && preview?.username2 ? (
      <>
        the full reading on <span className="text-primary">@{targetHandle}</span> ×{" "}
        <span className="text-primary">@{preview.username2}</span> 🔮
      </>
    ) : (
      <>the full reading is one credit away 🔮</>
    )
  ) : !targetHandle ? (
    <>you're out of free roasts</>
  ) : info.reroll ? (
    <>another round for <span className="text-primary">@{targetHandle}</span>? 🔁</>
  ) : isPair ? (
    <>
      <span className="text-primary">@{targetHandle}</span> ×{" "}
      <span className="text-primary">@{preview!.username2}</span> — verdict's ready to cook
    </>
  ) : (
    <>
      <span className="text-primary">@{targetHandle}</span>'s roast is ready to cook 🍳
    </>
  );

  // Placeholder prose behind the blur — never the real text, so nothing paid
  // leaks. It has to match the product being sold: single-roast lines about a
  // grid and a bio under a "@a × @b" headline read as the wrong screen.
  const secondHandle = preview?.username2;
  const teaserLines =
    info.deep && secondHandle
      ? [
          `the charts for @${targetHandle} and @${secondHandle} do not disagree politely.`,
          "one of you leads with fire, the other reads it as a personal attack. the placements explain the group chat, the timing explains everything else.",
          "the full reading names who bends first, and how long the peace lasts.",
        ]
      : isPair && secondHandle
        ? [
            `@${targetHandle} and @${secondHandle}: the grids alone told us more than either of you would.`,
            "one posts like the algorithm owes them rent, the other likes it within four seconds every single time. we have the receipts and we have the follower gap.",
            "the verdict says whether this survives a shared apartment or a shared playlist.",
          ]
        : [
            `okay @${targetHandle}, let's talk about that grid, because somebody has to.`,
            "the bio alone reads like a group project where everyone left early. and the posting schedule? bold choice to treat followers like a landlord treats repairs.",
            "we counted the selfie angles. all two of them. the algorithm is not your friend, it's your enabler.",
          ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center space-y-6">
      <div className="inline-block bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest rotate-[-2deg]">
        🔒 one step from the burn
      </div>

      <h1 className="text-2xl md:text-4xl font-serif font-bold italic text-balance">{headline}</h1>

      <p className="text-sm text-muted-foreground max-w-md mx-auto">{info.message}</p>

      {/* The goods, on display: real profile data when we have it cached.
          A pairing shows both faces; a single roast shows the full card. */}
      {isPair
        ? (preview?.profile || preview?.profile2) && (
            <div className="text-left animate-reveal">
              <PairPreview
                handle1={preview!.username}
                handle2={preview!.username2!}
                profile1={preview!.profile}
                profile2={preview!.profile2 ?? null}
              />
            </div>
          )
        : preview?.profile && (
            <div className="text-left animate-reveal">
              <ProfileCard
                profile={{
                  handle: preview.profile.username,
                  displayName: preview.profile.full_name,
                  avatarUrl: preview.profile.profile_pic_url,
                  posts: preview.profile.post,
                  followers: preview.profile.follower,
                  following: preview.profile.following,
                  bio: preview.profile.biography,
                }}
              />
            </div>
          )}

      {/* Blurred roast teaser — unreadable placeholder lines, not the real text,
          so nothing paid leaks. The lock overlay carries the actual CTA copy. */}
      {targetHandle && (
        <div className="relative bg-card border-2 border-foreground rounded-3xl p-8 shadow-brutal overflow-hidden text-left">
          <div className="space-y-3 blur-[6px] select-none" aria-hidden="true">
            {teaserLines.map((line, i) => (
              <p key={i} className={i === 0 ? "font-serif italic text-lg" : undefined}>
                {line}
              </p>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/50">
            <span className="text-4xl">🔒</span>
            <p className="font-serif italic font-bold text-lg">
              {info.deep
                ? "unlock the full reading"
                : isPair
                  ? "unlock the compatibility verdict"
                  : `unlock @${targetHandle}'s roast`}
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border-2 border-foreground rounded-3xl p-8 shadow-brutal space-y-5">
        <div className="inline-block bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest rotate-[-2deg]">
          {info.deep
            ? "🔮 unlock the full reading"
            : isPair
              ? "💘 unlock the verdict"
              : "🍿 keep the roasts coming"}
        </div>

        <div className="space-y-1">
          <div className="text-5xl font-black">{formatPrice(amount, currency)}</div>
          <div className="text-sm text-muted-foreground">
            {info.deep ? (
              <>
                {credits} credit{credits === 1 ? "" : "s"} · unlocks this reading · no account
                needed
              </>
            ) : isPair ? (
              <>
                {credits} credit{credits === 1 ? "" : "s"} · one unlocks this verdict · no account
                needed
              </>
            ) : (
              <>
                for {credits} more roast{credits === 1 ? "" : "s"}
                {perRoast ? ` — that's ${perRoast} a roast` : ""} · no account needed
              </>
            )}
          </div>
          {/* Free-roast tally is meaningless on the deep reading: it is paid
              credits only, so how many free roasts are left has no bearing on
              whether this unlocks. */}
          {freeLimit > 0 && !info.deep && (
            <div className="text-xs text-muted-foreground">
              you burned through {Math.min(freeUsed, freeLimit)}/{freeLimit} free roasts 🔥
            </div>
          )}
        </div>

        {usePaypal ? (
          <>
            {!paypalReady && !error && (
              <p className="text-sm text-muted-foreground">loading checkout…</p>
            )}
            {/* PayPal renders its buttons and the "Powered by PayPal" tagline
                assuming a light surface, so on the dark card they arrive as a
                bare white slab bleeding to the card's edges. Give them a panel
                that looks deliberate — brutal border, rounded corners, clipped
                — and only once the buttons exist, so nothing flashes empty
                while the SDK loads. */}
            <div
              className={`${
                paypalReady
                  ? "bg-white rounded-2xl border-2 border-foreground p-3 shadow-[3px_3px_0_0_hsl(var(--brutal))] overflow-hidden"
                  : ""
              } ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <div ref={paypalContainerRef} />
            </div>
          </>
        ) : (
          <button
            onClick={handleRazorpayUnlock}
            disabled={busy}
            className="w-full bg-primary text-primary-foreground border-2 border-foreground rounded-full px-6 py-3 font-bold hover:-translate-y-0.5 transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))] disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
          >
            {busy
              ? "opening checkout…"
              : info.deep
                ? "unlock the full reading"
                : isPair
                  ? "unlock the verdict"
                  : `unlock ${credits} more roasts`}
          </button>
        )}

        {error && <p className="text-sm text-destructive font-medium">{error}</p>}

        <div className="space-y-2 pt-1 border-t-2 border-dashed border-foreground/20">
          <p className="text-xs text-muted-foreground pt-2">
            {usePaypal
              ? "🔒 secure payment via PayPal · cards accepted · buyer protection"
              : "🔒 secure payment via Razorpay · UPI, cards, netbanking"}
          </p>
          <p className="text-xs text-muted-foreground">
            <Link to="/refund-policy" className="underline underline-offset-2 hover:text-foreground">
              refund policy
            </Link>{" "}
            ·{" "}
            <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
              terms
            </Link>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          onClick={() => track("paywall_abandoned", { surface, to: "home" })}
          className="inline-flex items-center justify-center gap-2 min-h-11 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold hover:-translate-y-0.5 transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))]"
        >
          ← back home
        </Link>
        <Link
          to="/leaderboard"
          onClick={() => track("paywall_abandoned", { surface, to: "leaderboard" })}
          className="inline-flex items-center justify-center gap-2 min-h-11 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold hover:-translate-y-0.5 transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))]"
        >
          or judge the hall of shame 🏆
        </Link>
      </div>
    </div>
  );
}
