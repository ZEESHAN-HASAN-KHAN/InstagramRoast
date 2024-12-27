"use client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Hero } from "./my_components/Hero";
import { Navbar } from "./my_components/Navbar";
import { About } from "./my_components/About";
import { Roast } from "./my_components/Roast";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Faq } from "./my_components/Faq";
import { motion } from "framer-motion";
import { AvatarCirclesDemo } from "./my_components/Contributors";
import React from "react";
import { Compatiblity } from "./my_components/Compatiblity";
import { CompatiblityRoast } from "./my_components/CompatiblityRoast";

const RedirectToUsername = () => {
  const navigate = useNavigate();
  const handleRedirect = () => {
    const path = window.location.pathname; // Get the current path
    if (path && path !== "/") {
      let username = path.substring(1); // Remove the leading slash
      if (username.includes("instagram.com")) {
        // Extract username from Instagram URL
        const instagramBase = "instagram.com/";
        const startIndex = username.indexOf(instagramBase);
        if (startIndex !== -1) {
          const extractedPart = username.substring(
            startIndex + instagramBase.length
          );
          const usernameArr = extractedPart.split("/").filter(Boolean);
          username = usernameArr[0];
        }
        // Redirect to /:username route
        navigate(`/${username}?language=english`);
      }   
    }
  };

  React.useEffect(() => {
    handleRedirect();
  }, []); // Runs once on mount

  return null; // Render nothing
};

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <div>
          {/* Redirect logic */}
          <RedirectToUsername />
          <Navbar />
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <Hero />
                  <Compatiblity />
                </>
              }
            />
            {/* <Route path="/" element={<Compatiblity />} /> */}
            <Route path="/:username" element={<Roast />} />
            <Route path="/compatiblityRoast" element={<CompatiblityRoast />} />
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
          <div className="fixed bottom-4 left-4 z-50  md:hidden">
            <AvatarCirclesDemo />
          </div>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
