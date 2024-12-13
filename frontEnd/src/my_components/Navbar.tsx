import { useState } from "react";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Link } from "react-router-dom";
import { AvatarCirclesDemo } from "./Contributors";
export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    } else {
      console.warn(`Section with id "${id}" not found`);
    }
  };

  return (
    <nav className="p-5  bg-white dark:bg-black">
      <div className="container mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to="/">
          <div
            style={{
              fontFamily: "Sansita",
              fontWeight: "600",
              fontStyle: "",
            }}
            className="text-xl  text-gray-800 dark:text-white flex items-center gap-2"
          >
            Instagram Roast 🔥
          </div>
        </Link>

        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden text-gray-800 dark:text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle Menu"
        >
          ☰
        </button>

        {/* Navigation Links */}
        <div
          className={`${
            isMenuOpen ? "block z-10 " : "hidden"
          } absolute top-16 left-0 w-full bg-white dark:bg-black  border-gray-300 dark:border-gray-700 lg:static lg:block lg:w-auto`}
        >
          <ul
            style={{
              fontFamily: "Sansita",
              fontWeight: "500",
              fontStyle: "",
            }}
            className="flex flex-col lg:flex-row items-center gap-5 text-gray-600 dark:text-gray-300 font-medium p-5 lg:p-0"
          >
            <li>
              <a
                onClick={() => {
                  scrollToSection("about");
                }}
                className="hover:text-gray-900 dark:hover:text-white hover:cursor-pointer"
              >
                Features
              </a>
            </li>
            <li>
              <a
                onClick={() => scrollToSection("about")}
                className="hover:text-gray-900 dark:hover:text-white hover:cursor-pointer"
              >
                About
              </a>
            </li>
            <li>
              <a
                onClick={() => scrollToSection("faq")}
                className="hover:text-gray-900 dark:hover:text-white hover:cursor-pointer"
              >
                FAQ
              </a>
            </li>
          </ul>
        </div>

        {/* Search Bar & Mode Toggle */}
        <div className="hidden lg:flex items-center gap-5">
          {/* <Search /> */}
          <AvatarCirclesDemo />
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
}
