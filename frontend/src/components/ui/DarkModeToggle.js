"use client";

import { useDarkMode } from "@/context/dark-mode-context";
import { FaSun, FaMoon } from "react-icons/fa";

export default function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {isDarkMode ? (
        <FaSun className="h-4 w-4" />
      ) : (
        <FaMoon className="h-4 w-4" />
      )}
    </button>
  );
}
