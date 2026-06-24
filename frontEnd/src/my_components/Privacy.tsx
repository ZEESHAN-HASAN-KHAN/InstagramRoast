import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

export function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Helmet>
        <title>Privacy Policy — InstaRoasts</title>
        <meta name="description" content="InstaRoasts privacy policy. We only use publicly available Instagram data, never store your photos, and don't sell your data." />
        <link rel="canonical" href="https://instaroasts.com/privacy" />
        <meta property="og:title" content="Privacy Policy — InstaRoasts" />
        <meta property="og:url" content="https://instaroasts.com/privacy" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-bold mb-10 hover:underline"
      >
        ← back to InstaRoasts
      </Link>

      <h1 className="text-4xl font-serif font-bold italic mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: June 2026</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/80 leading-relaxed">

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">1. What Data We Collect</h2>
          <p>
            When you use InstaRoasts, we temporarily access the following publicly available data from the Instagram profile you request:
          </p>
          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li>Username and display name</li>
            <li>Public biography text</li>
            <li>Follower and following counts</li>
            <li>Public post count and captions</li>
            <li>Public profile picture URL</li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> collect passwords, email addresses, or any data from private accounts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">2. How We Use Your Data</h2>
          <p>
            Profile data is used solely to generate an AI-powered roast for entertainment purposes. We do not use this data for advertising targeting, profiling, or any other commercial purpose beyond generating the roast.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">3. Data Retention</h2>
          <p>
            We do not persistently store profile pictures or biography text. Generated roast text may be cached briefly for performance purposes but is not linked to any personal identifier and is not sold or shared with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">4. Analytics</h2>
          <p>
            We use Google Analytics (GA4) to understand aggregate usage patterns (page views, session duration, device types). This data is anonymised and does not identify individual users. You can opt out via the <a href="https://tools.google.com/dlpage/gaoptout" className="underline" target="_blank" rel="noopener noreferrer">Google Analytics Opt-Out Browser Add-on</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">5. Cookies</h2>
          <p>
            We use cookies only for essential functionality (theme preference) and analytics (Google Analytics). No advertising cookies are used. Third-party ad scripts (Google AdSense) may set their own cookies — refer to Google's privacy policy for details.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">6. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li><strong>Google Analytics</strong> — usage analytics</li>
            <li><strong>Google AdSense</strong> — advertising (free-tier users)</li>
            <li><strong>OpenAI / AI providers</strong> — roast text generation</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">7. Your Rights</h2>
          <p>
            If you believe content generated about your profile should be removed, or if you have any privacy concerns, please contact us via the GitHub repositories linked in the footer. We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. The "last updated" date at the top of this page will reflect any changes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">9. Contact Us</h2>
          <p>
            For privacy-related requests, reach out via the GitHub repositories linked in the site footer.
          </p>
        </section>

      </div>
    </div>
  );
}
