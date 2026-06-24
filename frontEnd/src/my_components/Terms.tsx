import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

export function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Helmet>
        <title>Terms of Service — InstaRoasts</title>
        <meta name="description" content="Read the InstaRoasts terms of service. By using our AI Instagram roast generator you agree to these terms." />
        <link rel="canonical" href="https://instaroasts.com/terms" />
        <meta property="og:title" content="Terms of Service — InstaRoasts" />
        <meta property="og:url" content="https://instaroasts.com/terms" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-bold mb-10 hover:underline"
      >
        ← back to InstaRoasts
      </Link>

      <h1 className="text-4xl font-serif font-bold italic mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: June 2026</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground/80 leading-relaxed">

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using InstaRoasts ("the Service") at <a href="https://instaroasts.com" className="underline">instaroasts.com</a>, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">2. Description of Service</h2>
          <p>
            InstaRoasts is an AI-powered entertainment tool that generates humorous "roasts" based on publicly available Instagram profile data. All roasts are generated for entertainment purposes only and are not intended to harass, defame, or harm any individual.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">3. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc ml-6 space-y-1 mt-2">
            <li>Harass, bully, or target individuals with the intent to cause harm.</li>
            <li>Generate content about minors under the age of 18.</li>
            <li>Violate any applicable local, national, or international law.</li>
            <li>Attempt to reverse-engineer, scrape, or abuse the Service's API.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">4. Public Data Only</h2>
          <p>
            InstaRoasts only processes publicly available Instagram profile data. We do not access private accounts, passwords, or any non-public information. By roasting a profile, you confirm the profile is public and you have a legitimate purpose for doing so.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">5. Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" without warranties of any kind. Roast content is AI-generated and may be inaccurate, offensive, or nonsensical. InstaRoasts makes no guarantees about the accuracy or quality of generated content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">6. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, InstaRoasts and its creators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">7. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-2">8. Contact</h2>
          <p>
            Questions? Reach out via the GitHub repositories linked in the site footer.
          </p>
        </section>

      </div>
    </div>
  );
}
