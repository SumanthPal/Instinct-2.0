"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import DarkModeToggle from './DarkModeToggle';
import { FaBars, FaTimes, FaGoogle, FaUser, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '@/context/auth-context';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, signInWithGoogle, signOut, loading } = useAuth();
  const dropdownRef = useRef(null);


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
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Close dropdown when clicking outside
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

  return (
    <nav className="fixed w-full bg-transparent backdrop-blur-sm z-50">
      <div className="w-full px-8 py-4">
        <div className="hidden md:flex justify-between items-center w-full">
          {/* Left: Logo */}
          <div className="flex items-center space-x-3">
            <img src="/logo.svg" alt="Logo" className="h-12 w-12" />
            <span className="text-5xl font-bold text-gray-900 dark:text-white">
              Instinct
            </span>
          </div>

          {/* Center: Navigation Links */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-3xl text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/about" className="text-3xl text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white transition-colors">
              About
            </Link>
            <Link href="/clubs" className="text-3xl text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white transition-colors">
              Clubs
            </Link>
            <Link href="/dashboard" className="text-3xl text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>

          {/* Right: Auth & Dark Mode */}
          <div className="flex items-center space-x-4">
            {!loading && user && (user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center focus:outline-none"
                >
                  <img
                    src={user.user_metadata.avatar_url || user.user_metadata.picture}
                    alt="Profile"
                    className="h-10 w-10 rounded-full border-2 border-transparent hover:border-indigo-500 transition-colors cursor-pointer"
                  />
                </button>
                
                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.user_metadata.full_name || user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  onClick={handleGoogleSignIn}
                  className="flex items-center px-4 py-2 text-2xl font-medium text-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FaGoogle className="mr-2" />
                  Sign in with Google
                </button>
              )
            )}
            <DarkModeToggle />
          </div>
        </div>

        {/* Mobile Top Row */}
        <div className="md:hidden flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/logo.svg" alt="Logo" className="h-10 w-10" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              Instinct
            </span>
          </div>
          <div className="flex items-center">
            {!loading && user && (user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
              <div className="relative mr-4" ref={dropdownRef}>
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center focus:outline-none"
                >
                  <img
                    src={user.user_metadata.avatar_url || user.user_metadata.picture}
                    alt="Profile"
                    className="h-8 w-8 rounded-full border-2 border-transparent hover:border-indigo-500 transition-colors"
                  />
                </button>
                
                {/* Mobile Dropdown */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.user_metadata.full_name || user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  onClick={handleGoogleSignIn}
                  className="flex items-center mr-4 px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FaGoogle className="mr-1" />
                  Sign in
                </button>
              )
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
            >
              {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link href="/" className="block px-3 py-2 text-3xl text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/about" className="block px-3 py-2 text-3xl text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors">
                About
              </Link>
              <Link href="/clubs" className="block px-3 py-2 text-3xl text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors">
                Clubs
              </Link>

              <div className="px-3 py-2">
                <DarkModeToggle />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}