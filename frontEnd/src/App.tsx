"use client";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Hero } from "./my_components/Hero";
import { Navbar } from "./my_components/Navbar";
import { About } from "./my_components/About";
import { Roast } from "./my_components/Roast";
import { Faq } from "./my_components/Faq";
import { AvatarCirclesDemo } from "./my_components/Contributors";
import { ModeToggle } from "@/components/ui/ModeToggle";
import React from "react";
import { Compatibility } from "./my_components/Compatibility";
import { CompatiblityRoast } from "./my_components/CompatibilityRoast";
import { SiteFooter } from "./my_components/SiteFooter";
import { Terms } from "./my_components/Terms";
import { Privacy } from "./my_components/Privacy";

const LEGAL_PATHS = ["/terms", "/privacy"];

const RedirectToUsername = () => {
  const navigate = useNavigate();
  const handleRedirect = () => {
    const path = window.location.pathname;
    if (path && path !== "/") {
      let username = path.substring(1);
      if (username.includes("instagram.com")) {
        const instagramBase = "instagram.com/";
        const startIndex = username.indexOf(instagramBase);
        if (startIndex !== -1) {
          const extractedPart = username.substring(startIndex + instagramBase.length);
          const usernameArr = extractedPart.split("/").filter(Boolean);
          username = usernameArr[0];
        }
        navigate(`/${username}?language=english`);
      }
    }
  };

  React.useEffect(() => {
    handleRedirect();
  }, []);

  return null;
};

function AppLayout() {
  const { pathname } = useLocation();
  const isLegalPage = LEGAL_PATHS.includes(pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <RedirectToUsername />
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Hero />
                <Compatibility />
              </>
            }
          />
          <Route path="/compatibilityRoast" element={<CompatiblityRoast />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/:username" element={<Roast />} />
        </Routes>

        {!isLegalPage && (
          <>
            <About />
            <Faq />
          </>
        )}
      </main>

      <SiteFooter />

      {/* Mobile floating controls */}
      <div className="fixed bottom-4 right-4 z-50 opacity-80 md:hidden">
        <ModeToggle />
      </div>
      <div className="fixed bottom-4 left-4 z-50 md:hidden">
        <AvatarCirclesDemo />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ThemeProvider>
  );
}
