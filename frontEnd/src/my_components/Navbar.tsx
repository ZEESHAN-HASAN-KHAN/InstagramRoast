import { useState } from "react";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Link } from "react-router-dom";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b-2 border-foreground">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 group"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div className="size-9 bg-primary rounded-xl border-2 border-foreground flex items-center justify-center text-primary-foreground font-black text-lg -rotate-6 group-hover:rotate-6 transition-transform shadow-[2px_2px_0_0_hsl(var(--brutal))]">
            🔥
          </div>
          <span className="font-serif italic font-bold text-xl">
            insta_roasts
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-bold">
          <a
            onClick={() => scrollToSection("features")}
            className="hover:text-primary transition-colors cursor-pointer"
          >
            features
          </a>
          <Link to="/leaderboard" className="hover:text-primary transition-colors">
            🏆 leaderboard
          </Link>
          <a
            onClick={() => scrollToSection("faq")}
            className="hover:text-primary transition-colors cursor-pointer"
          >
            faq
          </a>
        </div>

        {/* Right side desktop */}
        <div className="hidden md:flex items-center gap-3">
          <ModeToggle />
          <span className="inline-flex items-center gap-1 bg-foreground text-background px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] hover:rotate-0 transition-transform cursor-default">
            🌶️ spicy
          </span>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden size-11 -mr-2 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          <div className="w-5 flex flex-col gap-1.5">
            <span
              className={`block h-0.5 bg-foreground rounded-full transition-all ${isMenuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`block h-0.5 bg-foreground rounded-full transition-all ${isMenuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block h-0.5 bg-foreground rounded-full transition-all ${isMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t-2 border-foreground bg-background">
          {/* min-h-11 rather than padding alone: these are the only nav on a
              phone and a 20px-tall text link is not a target. */}
          <div className="flex flex-col px-6 py-2 font-bold text-sm">
            <a
              onClick={() => scrollToSection("features")}
              className="cursor-pointer hover:text-primary flex items-center min-h-11"
            >
              features
            </a>
            <Link
              to="/leaderboard"
              onClick={() => setIsMenuOpen(false)}
              className="hover:text-primary flex items-center min-h-11"
            >
              🏆 leaderboard
            </Link>
            <a
              onClick={() => scrollToSection("faq")}
              className="cursor-pointer hover:text-primary flex items-center min-h-11"
            >
              faq
            </a>
            <div className="flex items-center gap-3 mt-2 pt-3 pb-2 border-t border-border">
              <ModeToggle />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
