import { useEffect, useRef, useState } from "react";
import {
  capturePaypalOrder,
  createMintOrder,
  createMintPaypalOrder,
  formatPrice,
  getPaypalConfig,
  verifyPayment,
  type MintFulfilment,
  type MintState,
  type RazorpayCheckoutResult,
} from "@/lib/api";
import {
  loadPaypalSdk,
  prefetchRazorpay,
  waitForRazorpay,
  type PaypalButtonsInstance,
} from "@/lib/checkout";
import { track } from "@/lib/analytics";

// Every card carries a permanent mint number: #1 is the first person on earth
// to roast that handle, and the number never moves once it's assigned. The
// claim sells the one thing a re-roll can't — your name printed on that number
// forever, seen by everyone who roasts the handle afterwards.
//
// Offered in two places, for two different reasons. Under a freshly revealed
// card, because that's the moment the number means something to the person who
// just pulled it. And on an archived card, because that is where the scarce
// numbers actually live: the instant a handle gets roasted twice, its mint #1
// stops being the live card and is only reachable through the archive. Without
// the second surface the premium rung would only ever sell on handles nobody
// had touched yet.

type MintClaimProps = {
  username: string;
  language: string;
  mint: MintState;
  /**
   * The card being claimed. Always sent where it's known so the claim can't
   * drift onto a newer card between opening the panel and paying — and it is
   * what makes an archived #1 sellable at all.
   */
  responseId?: number;
  /** Rarity of the card being claimed — carried into analytics, not priced on. */
  tier: string;
  /**
   * Set when this card has been superseded by a re-roll. Doesn't change the
   * purchase, only the copy: on the archive the number is the whole pitch,
   * because the roast itself is no longer the live one.
   */
  archived?: boolean;
  /** Fires once the claim is confirmed, so the card face can repaint. */
  onClaimed: (fulfilment: MintFulfilment) => void;
};

export function MintClaim({
  username,
  language,
  mint,
  responseId,
  tier,
  archived = false,
  onClaimed,
}: MintClaimProps) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalContainerRef = useRef<HTMLDivElement>(null);

  const isFirst = mint.no === 1;
  const currency = mint.price?.currency ?? "INR";
  const amount = mint.price?.amount ?? 0;
  const usePaypal = currency !== "INR";
  const value = amount / 100;

  // The typed handle is read through a ref inside the PayPal callbacks: those
  // close over the render that created them, and re-rendering the buttons on
  // every keystroke would tear down an open checkout.
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const items = [
    {
      item_id: `mint_${mint.no}`,
      item_name: isFirst ? "First Mint claim" : `Mint #${mint.no} claim`,
      item_category: "mint_claim",
      price: value,
      quantity: 1,
    },
  ];

  // See the same call in Paywall: the checkout SDK is fetched when a surface
  // that can charge appears, not on every page load.
  useEffect(() => {
    if (mint.claimable) prefetchRazorpay();
  }, [mint.claimable]);

  useEffect(() => {
    if (!mint.claimable) return;
    track("mint_claim_shown", {
      mint_no: mint.no,
      is_first_mint: isFirst,
      archived,
      tier,
      currency,
      value,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function typedHandle(): string {
    return handle.trim().replace(/^@+/, "");
  }

  function onConfirmed(
    fulfilment: MintFulfilment | null,
    transactionId: string,
    gateway: string
  ) {
    track("purchase", { transaction_id: transactionId, gateway, currency, value, items });
    track("mint_claimed", { mint_no: mint.no, is_first_mint: isFirst, tier, gateway });
    if (fulfilment) {
      onClaimed(fulfilment);
      return;
    }
    // Paid, but the number went elsewhere in the seconds between reserving and
    // capturing. The backend logs that for a refund; the buyer must not be left
    // looking at a success state for something they didn't get.
    setError(
      "Payment went through but that mint was claimed first. We've logged it — mail us and we'll refund you."
    );
  }

  useEffect(() => {
    if (!usePaypal || !mint.claimable) return;

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
            const typed = handleRef.current.trim().replace(/^@+/, "");
            if (!typed) {
              setError("Type the Instagram handle to print on the card");
              throw new Error("no handle");
            }
            track("mint_checkout_opened", { gateway: "paypal", mint_no: mint.no });
            track("begin_checkout", { gateway: "paypal", currency, value, items });
            const order = await createMintPaypalOrder({ username, language, handle: typed, responseId });
            return order.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            setBusy(true);
            try {
              const result = await capturePaypalOrder(data.orderID);
              onConfirmed(result.mint, data.orderID, "paypal");
            } catch {
              track("purchase_failed", { gateway: "paypal", stage: "capture" });
              setError(
                "Payment went through but we couldn't confirm it yet — refresh in a moment."
              );
            } finally {
              setBusy(false);
            }
          },
          onError: () => {
            setBusy(false);
            track("purchase_failed", { gateway: "paypal", stage: "paypal_error" });
            // createOrder throws to abort checkout when the handle field is
            // empty, and PayPal reports that here as a generic failure. Keep
            // whatever specific reason is already on screen — "type your
            // handle" is far more useful than "try again in a moment".
            setError((current) => current ?? "Couldn't start checkout. Try again in a moment.");
          },
          onCancel: () => {
            setBusy(false);
            track("checkout_dismissed", { gateway: "paypal" });
          },
        });

        await buttons.render(paypalContainerRef.current);
        if (!cancelled) setPaypalReady(true);
      } catch {
        if (!cancelled) {
          track("purchase_failed", { gateway: "paypal", stage: "sdk_load" });
          setError("Checkout didn't load — check your connection and refresh.");
        }
      }
    })();

    return () => {
      cancelled = true;
      buttons?.close().catch(() => {});
    };
    // Re-running this would tear down the PayPal buttons mid-checkout; the typed
    // handle is read through handleRef precisely so it isn't a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePaypal, mint.claimable]);

  async function handleRazorpayClaim() {
    const typed = typedHandle();
    if (!typed) {
      setError("Type the Instagram handle to print on the card");
      return;
    }

    setError(null);
    setBusy(true);

    if (!(await waitForRazorpay())) {
      track("purchase_failed", { gateway: "razorpay", stage: "sdk_load" });
      setError("Checkout didn't load — check your connection and refresh.");
      setBusy(false);
      return;
    }

    try {
      track("mint_checkout_opened", { gateway: "razorpay", mint_no: mint.no });
      track("begin_checkout", { gateway: "razorpay", currency, value, items });
      const order = await createMintOrder({ username, language, handle: typed, responseId });

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "InstaRoasts",
        description: `Mint #${order.mintNo} of @${username}`,
        theme: { color: "#f43f5e" },
        handler: async (response: RazorpayCheckoutResult) => {
          try {
            const result = await verifyPayment(response);
            onConfirmed(result.mint, order.orderId, "razorpay");
          } catch {
            track("purchase_failed", { gateway: "razorpay", stage: "verify" });
            setError(
              "Payment went through but we couldn't confirm it yet — refresh in a moment."
            );
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            track("checkout_dismissed", { gateway: "razorpay" });
            setBusy(false);
          },
        },
      });

      checkout.open();
    } catch (err) {
      // The order routes answer 409 when the mint was just claimed or is held by
      // another checkout, and 400 for a handle that isn't a real account. Those
      // messages are written for the buyer, so they are shown as they arrive.
      track("purchase_failed", { gateway: "razorpay", stage: "create_order" });
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setBusy(false);
    }
  }

  // Already claimed — the card credits its owner, which is the whole product.
  if (mint.claimedBy) {
    return (
      <div className="text-center">
        <span className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-4 py-1.5 text-xs font-black rotate-[-1deg] shadow-[3px_3px_0_0_hsl(var(--brutal))]">
          {isFirst ? "👑 first mint on earth" : `🏷️ mint #${mint.no}`}
          <span className="text-primary">@{mint.claimedBy}</span>
        </span>
      </div>
    );
  }

  // Nothing to sell where monetization is switched off. The number still shows
  // — it's part of the card either way — it just isn't for sale in this region.
  if (!mint.claimable || !mint.price) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        mint #{mint.no} of {mint.total}
      </p>
    );
  }

  return (
    <div className="bg-card border-2 border-foreground rounded-3xl p-5 space-y-4 shadow-brutal">
      <div className="text-center space-y-1.5">
        <div className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-[-2deg]">
          {isFirst ? "👑 first mint on earth" : `🏷️ mint #${mint.no}`}
        </div>
        <h3 className="text-xl md:text-2xl font-serif font-bold italic text-balance">
          {isFirst ? (
            archived ? (
              <>
                this is the very first roast of{" "}
                <span className="text-primary">@{username}</span> — still unclaimed
              </>
            ) : (
              <>
                nobody has ever roasted <span className="text-primary">@{username}</span> before you
              </>
            )
          ) : (
            <>
              {archived ? "this is" : "you hold"} mint #{mint.no} of{" "}
              <span className="text-primary">@{username}</span>
            </>
          )}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {isFirst
            ? archived
              ? // The pitch on the archive is ownership, not luck — whoever pulled
                // this card is long gone, and the number is sitting there unowned.
                "whoever pulled it never claimed it. put your handle on the first card of this handle, permanently — everyone who roasts them sees it."
              : "claim it and your handle prints on this card forever — everyone who roasts them after you sees who got here first."
            : `${mint.total} cards minted so far. claim this number and your handle prints on it permanently.`}
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="mint-handle"
          className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          your instagram handle
        </label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono font-black text-muted-foreground">@</span>
          <input
            id="mint-handle"
            type="text"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              if (error) setError(null);
            }}
            placeholder="yourhandle"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            className="flex-1 w-full min-w-0 px-4 py-3 bg-background border-2 border-foreground rounded-2xl font-mono outline-none focus:shadow-[3px_3px_0_0_hsl(var(--primary))] transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          printed on the card face, permanently. we check the account exists.
        </p>
      </div>

      {mint.heldByOther && (
        <p className="text-center text-xs font-bold text-primary">
          ⏳ someone else has checkout open on this mint. worth trying anyway — holds expire in a
          few minutes.
        </p>
      )}

      {usePaypal ? (
        <div className="space-y-2">
          <p className="text-center text-sm font-black">{formatPrice(amount, currency)}</p>
          {!paypalReady && (
            <p className="text-sm text-center text-muted-foreground">loading checkout…</p>
          )}
          <div ref={paypalContainerRef} className={busy ? "pointer-events-none opacity-60" : ""} />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleRazorpayClaim}
          disabled={busy}
          className="w-full bg-primary text-primary-foreground border-2 border-foreground rounded-full px-6 py-3 font-black hover:-translate-y-0.5 transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))] disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
        >
          {busy ? "opening checkout…" : `claim mint #${mint.no} · ${formatPrice(amount, currency)}`}
        </button>
      )}

      {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}

      <p className="text-center text-[11px] text-muted-foreground">
        one-time. not a subscription. claims can't be transferred or undone.
      </p>
    </div>
  );
}
