"use client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// import { cn } from "@/lib/utils";
// import { DotPattern } from "@/components/ui/dot-pattern";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Hero } from "./my_components/Hero";
import { Navbar } from "./my_components/Navbar";
import { About } from "./my_components/About";
import { Roast } from "./my_components/Roast";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Faq } from "./my_components/Faq";
import { motion } from "framer-motion";

// import Meteors from "./components/ui/meteors";
export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <div>
          <Navbar />
          <Routes>
            <Route path="/" element={<Hero />} />
            {/* <Route path="/about" element={<About />} /> */}
            {/* <Route path="/faq" element={<Faq />} /> */}
            <Route path="/:username" element={<Roast />} />
          </Routes>
          {/* ScrollToSection using framer-motion */}
          <motion.div
            id="about"
            className="section"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <About />
          </motion.div>
          <motion.div
            id="faq"
            className="section1"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <Faq />
          </motion.div>
          <div className="fixed bottom-4 right-4 z-50 opacity-80 md:hidden">
            <ModeToggle />
          </div>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
