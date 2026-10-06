"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import DarkModeToggle from "./DarkModeToggle";
import {
  FaBars,
  FaTimes,
  FaGoogle,
  FaUserCircle,
  FaSignOutAlt,
} from "react-icons/fa";
import { FiSearch } from "react-icons/fi";
import { useAuth } from "@/context/auth-context";

// cmdk + Radix Dialog load on first open (or idle), not with every page.
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, signInWithGoogle, signOut, loading } = useAuth();
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteReady, setPaletteReady] = useState(false);

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteReady(true);
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => {
    setIsOpen(false);
    setPaletteReady(true);
    setPaletteOpen(true);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setDropdownOpen(false);
      setIsOpen(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (
        isOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target) &&
        !(
          event.target.closest("button")?.getAttribute("aria-label") ===
          "Toggle mobile menu"
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const desktopLink = (href) => {
    const active = pathname === href;
    return active
      ? "instinct-nav-active text-[15px] font-medium text-foreground"
      : "text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground";
  };

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Instinct"
              className="h-9 w-9 sm:h-10 sm:w-10"
            />
            <span className="text-xl font-semibold tracking-tight text-foreground sm:text-[22px]">
              Instinct
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <Link href="/clubs" className={desktopLink("/clubs")}>
              Clubs
            </Link>
            <Link href="/events" className={desktopLink("/events")}>
              Events
            </Link>
            <Link href="/news" className={desktopLink("/news")}>
              News
            </Link>
            <Link href="/about" className={desktopLink("/about")}>
              About
            </Link>
            {user && (
              <Link href="/dashboard" className={desktopLink("/dashboard")}>
                Dashboard
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search clubs"
            aria-keyshortcuts="Meta+K Control+K"
            className="hidden h-8 items-center gap-2 rounded-full border border-border bg-transparent pl-3 pr-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            Search
            <kbd className="rounded-md border border-border bg-muted px-1.5 text-[10px] leading-4">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search clubs"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
          >
            <FiSearch className="h-4 w-4" aria-hidden="true" />
          </button>
          <DarkModeToggle />
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center rounded-full"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <FaUserCircle className="h-9 w-9 text-muted-foreground" />
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-md border border-border bg-popover py-2 text-popover-foreground shadow-sm">
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold">
                      {user.user_metadata.full_name || user.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <FaSignOutAlt className="mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            !loading && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                title="Sign in with your UCI Google account"
                className="hidden h-8 items-center rounded-full border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
              >
                Sign in
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Toggle mobile menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
          </button>
        </div>
      </div>

      <div
        ref={mobileMenuRef}
        id="mobile-menu"
        inert={!isOpen}
        className={`overflow-hidden border-b border-border transition-all duration-300 ease-in-out md:hidden ${
          isOpen ? "max-h-[60vh] opacity-100" : "invisible max-h-0 border-b-0 opacity-0"
        }`}
      >
        <div className="mx-3 mb-3 rounded-md border border-border bg-card p-3">
          <div className="flex flex-col gap-0.5">
            <NavLink href="/clubs" active={pathname === "/clubs"}>
              Clubs
            </NavLink>
            <NavLink href="/events" active={pathname === "/events"}>
              Events
            </NavLink>
            <NavLink href="/news" active={pathname === "/news"}>
              News
            </NavLink>
            <NavLink href="/about" active={pathname === "/about"}>
              About
            </NavLink>
            {user && (
              <NavLink href="/dashboard" active={pathname === "/dashboard"}>
                Dashboard
              </NavLink>
            )}
          </div>

          {!loading && !user && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="mt-3 flex w-full items-center justify-center rounded-full border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FaGoogle className="mr-2" size={14} />
              Sign in with UCI
            </button>
          )}

          {!loading && user && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-2 flex items-center gap-3">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                    alt=""
                  />
                ) : (
                  <FaUserCircle className="h-9 w-9 text-muted-foreground" />
                )}
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold">
                    {user.user_metadata.full_name || user.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center rounded-lg py-2 text-sm font-medium text-red-600 hover:bg-accent dark:text-red-400"
              >
                <FaSignOutAlt className="mr-2" size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
      {paletteReady && (
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      )}
    </nav>
  );
}

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
