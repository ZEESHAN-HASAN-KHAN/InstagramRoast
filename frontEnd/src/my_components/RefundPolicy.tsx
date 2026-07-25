import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

export function RefundPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Helmet>
        <title>Refund & Cancellation Policy — InstaRoasts</title>
        <meta name="description" content="InstaRoasts refund and cancellation policy: how failed roast purchases are credited back, and how to request a refund." />
        <link rel="canonical" href="https://instaroasts.com/refund-policy" />
        <meta property="og:title" content="Refund & Cancellation Policy — InstaRoasts" />
        <meta property="og:url" content="https://instaroasts.com/refund-policy" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-bold mb-10 hover:underline"
      >
        ← back to InstaRoasts
      </Link>

      <h1 className="text-4xl font-serif font-bold italic mb-2">Refund &amp; Cancellation Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: July 2026</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/80 leading-relaxed">

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">1. Nothing to Cancel</h2>
          <p>
            InstaRoasts does not offer subscriptions. Every payment is a single, one-time purchase that unlocks 2 additional roasts (₹100 in India, $1.99 elsewhere) — there is no recurring billing, so there is nothing to "cancel."
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">2. If a Purchased Roast Fails to Generate</h2>
          <p>
            Occasionally a roast can't be generated — the Instagram profile is unavailable, or our AI provider is temporarily down. If this happens to a roast you paid for, <strong>the system automatically returns that credit to your session</strong> so you can use it again for any profile, at no extra cost and with no action needed on your part.
          </p>
          <p className="mt-2">
            This automatic credit is tied to your anonymous browser session and is valid as long as that session lasts (up to 7 days, or until cookies are cleared).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">3. Once a Roast Is Delivered</h2>
          <p>
            Because InstaRoasts delivers a digital result instantly (the generated roast text, shown in your browser), we do not offer refunds for roasts that were successfully generated and displayed — this follows standard practice for instantly-delivered digital content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">4. Payment Charged but No Credits Received</h2>
          <p>
            If Razorpay confirms a successful payment but your account was not credited (for example, you closed the browser tab immediately after paying), our system reconciles this automatically within a few minutes in most cases. If it doesn't resolve on its own, contact us with your payment ID (visible in your Razorpay payment confirmation email or SMS) via the GitHub repositories linked in the site footer, and we will manually verify and either credit your session or process a refund to your original payment method.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">5. Duplicate or Accidental Charges</h2>
          <p>
            If you were charged more than once for the same purchase, contact us with both payment IDs and we will refund the duplicate charge to your original payment method. Refunds are processed via Razorpay and typically reflect in 5–7 business days, depending on your bank or card issuer.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">6. How to Reach Us</h2>
          <p>
            For any payment issue not resolved automatically, reach out via the GitHub repositories linked in the site footer with your Razorpay payment ID and a short description of the issue. We aim to respond within a few business days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">7. Related Policies</h2>
          <p>
            See our <Link to="/terms" className="underline">Terms of Service</Link> for details on pricing and how the Service works, and our <Link to="/privacy" className="underline">Privacy Policy</Link> for what payment-related data we store.
          </p>
        </section>

      </div>
    </div>
  );
}
