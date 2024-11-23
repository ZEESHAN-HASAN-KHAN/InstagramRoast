"use client";

import { cn } from "@/lib/utils";
import { DotPattern } from "@/components/ui/dot-pattern";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Hero } from "./my_components/Hero";
import { Navbar } from "./my_components/Navbar";
import { About } from "./my_components/About";
export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div>
        <Navbar />
        <Hero />
        <About />
        <DotPattern
          className={cn(
            "[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]"
          )}
        />
      </div>
    </ThemeProvider>
  );
}
