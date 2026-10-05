"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "instinct-theme";
const LEGACY_KEY = "isDarkMode";

const DarkModeContext = createContext({
  theme: "system",
  resolvedTheme: "dark",
  isDarkMode: false,
  setTheme: () => {},
  toggleDarkMode: () => {},
});

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    // Migrate legacy boolean flag from older builds
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === "true") return "dark";
    if (legacy === "false") return "light";
  } catch (_) {}
  return "system";
}

function applyThemeClass(resolved) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function DarkModeProvider({ children }) {
  const [theme, setThemeState] = useState("system");
  const [system, setSystem] = useState("dark");

  useEffect(() => {
    setThemeState(readStoredTheme());
    setSystem(getSystemTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = theme === "system" ? system : theme;

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      // Keep legacy key in sync for any leftover readers
      if (next === "system") localStorage.removeItem(LEGACY_KEY);
      else localStorage.setItem(LEGACY_KEY, String(next === "dark"));
    } catch (_) {}
  }, []);

  const toggleDarkMode = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDarkMode: resolvedTheme === "dark",
      setTheme,
      toggleDarkMode,
    }),
    [theme, resolvedTheme, setTheme, toggleDarkMode],
  );

  // Always render children (no blank shell) — theme class is set by the
  // layout inline script before paint, and kept in sync here.
  return (
    <DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>
  );
}

export const useDarkMode = () => useContext(DarkModeContext);
