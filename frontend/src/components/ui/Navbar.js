"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DarkModeToggle from './DarkModeToggle';
import { FaBars, FaTimes, FaGoogle, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '@/context/auth-context';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, signInWithGoogle, signOut, loading } = useAuth();
  const dropdownRef = useRef(null);
  const pathname = usePathname();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setDropdownOpen(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navLinkClass = (href) => `
    text-xl font-medium transition
    ${pathname === href 
      ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
      : 'text-gray-700 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400'}
  `;

  return (
    <Suspense fallback={null}>

<nav className="fixed w-full overflow-x-hidden bg-white/40 dark:bg-dark-profile-card/80 backdrop-blur-lg z-50 shadow-sm rounded-3xl">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <img src="/logo.svg" alt="Logo" className="h-10 w-10" />
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            Instinct
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/" className={navLinkClass('/')}>
            Home
          </Link>
          <Link href="/about" className={navLinkClass('/about')}>
            About
          </Link>
          <Link href="/clubs" className={navLinkClass('/clubs')}>
            Clubs
          </Link>
          <Link href="/dashboard" className={navLinkClass('/dashboard')}>
            Dashboard
          </Link>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-4">
          {!loading && user ? (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 focus:outline-none"
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="h-10 w-10 rounded-full border-2 border-transparent hover:border-indigo-500 transition"
                  />
                ) : (
                  <FaUserCircle size={36} className="text-gray-600 dark:text-gray-300" />
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-lg shadow-lg py-2 z-20">
                  <div className="px-4 py-2 border-b dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                      {user.user_metadata.full_name || user.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-gradient-start transition"
                  >
                    <FaSignOutAlt className="inline mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            !loading && (
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-white bg-gray-100 dark:bg-dark-card rounded-full hover:bg-gray-200 dark:hover:bg-dark-gradient-start transition"
              >
                <FaGoogle className="mr-2" />
                Sign in
              </button>
            )
          )}
          <DarkModeToggle />
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-white"
            >
              {isOpen ? <FaTimes size={28} /> : <FaBars size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0 overflow-hidden'}`}>

  <div className="px-6 pt-6 pb-10 bg-white/50 dark:bg-dark-profile-card/70 backdrop-blur-2xl rounded-2xl mx-4 mt-2 shadow-lg space-y-8">
    <Link href="/" onClick={() => setIsOpen(false)} className="block w-full text-center py-3 text-2xl font-semibold text-gray-800 dark:text-white bg-white/60 dark:bg-dark-profile-card/80 rounded-xl hover:bg-lavender/30 dark:hover:bg-dark-gradient-start transition">
      Home
    </Link>
    <Link href="/about" onClick={() => setIsOpen(false)} className="block w-full text-center py-3 text-2xl font-semibold text-gray-800 dark:text-white bg-white/60 dark:bg-dark-profile-card/80 rounded-xl hover:bg-lavender/30 dark:hover:bg-dark-gradient-start transition">
      About
    </Link>
    <Link href="/clubs" onClick={() => setIsOpen(false)} className="block w-full text-center py-3 text-2xl font-semibold text-gray-800 dark:text-white bg-white/60 dark:bg-dark-profile-card/80 rounded-xl hover:bg-lavender/30 dark:hover:bg-dark-gradient-start transition">
      Clubs
    </Link>
    <Link href="/dashboard" onClick={() => setIsOpen(false)} className="block w-full text-center py-3 text-2xl font-semibold text-gray-800 dark:text-white bg-white/60 dark:bg-dark-profile-card/80 rounded-xl hover:bg-lavender/30 dark:hover:bg-dark-gradient-start transition">
      Dashboard
    </Link>

    {!loading && user && (
      <div className="pt-6 border-t dark:border-gray-600">
        <div className="flex items-center space-x-4 mb-4">
          {user.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="h-10 w-10 rounded-full" />
          ) : (
            <FaUserCircle size={32} className="text-gray-600 dark:text-gray-300" />
          )}
          <div className="text-left">
            <p className="text-base font-semibold text-gray-900 dark:text-white">{user.user_metadata.full_name || user.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-center py-3 text-lg font-semibold text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-xl transition"
        >
          Sign Out
        </button>
      </div>
    )}
  </div>
</div>
    </nav>
    </Suspense>

  );
}
