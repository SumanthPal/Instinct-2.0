"use client";

import { useDarkMode } from "@/context/dark-mode-context";
import { FaSun, FaMoon } from "react-icons/fa";

// Icons switch with the `dark` class on <html> (set before paint by the
// layout script), so the first render is right for both themes and there is
// no swap after hydration.
export default function DarkModeToggle() {
  const { toggleDarkMode } = useDarkMode();

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label="Toggle dark mode"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <FaMoon className="h-4 w-4 dark:hidden" aria-hidden="true" />
      <FaSun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
    </button>
  );
}
