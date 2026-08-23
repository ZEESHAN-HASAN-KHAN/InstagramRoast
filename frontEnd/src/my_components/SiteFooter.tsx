import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="bg-neutral-950 text-white/50 py-12 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="font-mono text-xs font-bold text-white">INSTA_ROAST © 2026</div>
        {/* Wraps. Five nowrap links at gap-8 have a ~430px min-content width, so
            as a single non-wrapping row they pushed the document wider than a
            phone viewport and the whole site scrolled sideways. */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs uppercase tracking-widest font-bold">
          {/* Sitewide internal link. A new page reached only from the sitemap
              waits on a re-crawl; one in the footer is on every page already
              in the index. */}
          <Link to="/cosmic-match" className="hover:text-white transition-colors">Cosmic Match</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/refund-policy" className="hover:text-white transition-colors">Refunds</Link>
          <a href="https://github.com/ZEESHAN-HASAN-KHAN/InstagramRoast" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
        </div>
        <div className="text-[10px] text-center md:text-right">
          MADE WITH 🔥 BY THE TEAM AT <br />
          <span className="text-white">INSTAROASTS</span>
        </div>
      </div>
    </footer>
  );
}
