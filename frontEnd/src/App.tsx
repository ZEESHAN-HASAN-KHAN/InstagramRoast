"use client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// import { cn } from "@/lib/utils";
// import { DotPattern } from "@/components/ui/dot-pattern";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Hero } from "./my_components/Hero";
import { Navbar } from "./my_components/Navbar";
import { About } from "./my_components/About";
import { Roast } from "./my_components/Roast";
export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <div>
          <Navbar />
          <Routes>
            <Route path="/" element={<Hero />} />
            <Route path="/:userName" element={<Roast />} />
          </Routes>
          <About />
          {/* <DotPattern
          className={cn(
            "[mask-image:radial-gradient(200px_circle_at_center,white,transparent)]"
          )}
        /> */}
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
