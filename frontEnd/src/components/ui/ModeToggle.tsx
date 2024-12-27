import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "./theme-provider";
import { useEffect } from "react";

type Theme = "light" | "dark" | "system"; // Define or import the Theme type if not already available

export function ModeToggle() {
  const { setTheme } = useTheme();

  useEffect(() => {
    // Check for a saved user preference in localStorage
    const savedTheme = localStorage.getItem("theme") as Theme;
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      setTheme(savedTheme);
    } else {
      // Default to system preference if no valid user preference exists
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(systemPrefersDark ? "dark" : "light");
    }

    // Listen for system theme changes
    const systemThemeListener = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (!localStorage.getItem("theme")) {
        // Only apply system changes if no user preference exists
        setTheme(systemThemeListener.matches ? "dark" : "light");
      }
    };
    systemThemeListener.addEventListener("change", handleSystemThemeChange);

    return () => {
      systemThemeListener.removeEventListener("change", handleSystemThemeChange);
    };
  }, [setTheme]);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme); // Persist user preference
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => updateTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            localStorage.removeItem("theme"); // Remove user preference to defer to system preference
            const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            setTheme(systemPrefersDark ? "dark" : "light");
          }}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
