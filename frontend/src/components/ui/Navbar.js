"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DarkModeToggle from "./DarkModeToggle";
import {
  FaBars,
  FaTimes,
  FaGoogle,
  FaUserCircle,
  FaSignOutAlt,
} from "react-icons/fa";
import { useAuth } from "@/context/auth-context";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, signInWithGoogle, signOut, loading } = useAuth();
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const pathname = usePathname();

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
      ? "instinct-nav-active text-sm font-medium text-foreground"
      : "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  };

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Instinct"
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
            <span className="instinct-text text-lg font-semibold tracking-tight sm:text-xl">
              Instinct
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link href="/" className={desktopLink("/")}>
              Home
            </Link>
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
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center rounded-full"
                aria-label="Open account menu"
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <FaUserCircle className="h-8 w-8 text-muted-foreground" />
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-border bg-popover py-2 text-popover-foreground shadow-lg">
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
                className="instinct-btn hidden items-center rounded-full px-3.5 py-1.5 text-xs font-medium md:inline-flex"
              >
                <FaGoogle className="mr-2" size={12} />
                Sign in with UCI
              </button>
            )
          )}
          <DarkModeToggle />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Toggle mobile menu"
          >
            {isOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
          </button>
        </div>
      </div>

      <div
        ref={mobileMenuRef}
        className={`overflow-hidden border-b border-border/80 transition-all duration-300 ease-in-out md:hidden ${
          isOpen ? "max-h-[60vh] opacity-100" : "max-h-0 border-b-0 opacity-0"
        }`}
      >
        <div className="mx-3 mb-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <NavLink href="/" active={pathname === "/"}>
              Home
            </NavLink>
            <NavLink href="/about" active={pathname === "/about"}>
              About
            </NavLink>
            <NavLink href="/clubs" active={pathname === "/clubs"}>
              Clubs
            </NavLink>
            <NavLink href="/events" active={pathname === "/events"}>
              Events
            </NavLink>
            <NavLink href="/news" active={pathname === "/news"}>
              News
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
              className="instinct-btn mt-3 flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-medium"
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
    </nav>
  );
}

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
