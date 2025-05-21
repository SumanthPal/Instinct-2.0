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
  const mobileMenuRef = useRef(null);
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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (isOpen && mobileMenuRef.current && 
          !mobileMenuRef.current.contains(event.target) && 
          !(event.target.closest('button')?.getAttribute('aria-label') === 'Toggle mobile menu')) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close mobile menu when window is resized to desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navLinkClass = (href) => `
    text-lg font-medium transition duration-200 relative py-2
    ${pathname === href 
      ? 'text-indigo-600 dark:text-indigo-400 font-semibold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-indigo-500 dark:after:bg-indigo-400 after:rounded-full' 
      : 'text-gray-700 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-indigo-400 hover:after:w-full after:transition-all after:duration-300'}
  `;

  return (
    <nav className="fixed w-full bg-white/60 dark:bg-dark-profile-card/80 backdrop-blur-lg z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <img src="/logo.svg" alt="Logo" className="h-9 w-9 sm:h-10 sm:w-10 cursor-pointer" />
          <span className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Instinct
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
          <Link href="/" className={navLinkClass('/')}>
            Home
          </Link>
          <Link href="/about" className={navLinkClass('/about')}>
            About
          </Link>
          <Link href="/clubs" className={navLinkClass('/clubs')}>
            Clubs
          </Link>
          <Link href="/news" className={navLinkClass('/news')}>
            News
          </Link>
          <Link href="/dashboard" className={navLinkClass('/dashboard')}>
            Dashboard
          </Link>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-3 lg:space-x-4">
          {!loading && user ? (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 focus:outline-none"
                aria-label="User menu"
              >
                {user.user_metadata?.avatar_url ? (
                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full opacity-75 group-hover:opacity-100 blur-sm transition duration-200"></div>
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Avatar"
                      className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover border-2 border-white dark:border-gray-800"
                    />
                  </div>
                ) : (
                  <div className="rounded-full p-1 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 border border-white/20 dark:border-dark-text/10">
                    <FaUserCircle size={32} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right backdrop-blur-sm bg-white/90 dark:bg-dark-card/90 rounded-xl shadow-lg py-2 z-[200] border border-white/20 dark:border-dark-text/10 transition ease-out duration-100 transform scale-100">
                  <div className="px-4 py-3 border-b dark:border-gray-700/30">
                    <p className="text-base font-semibold text-gray-800 dark:text-white truncate">
                      {user.user_metadata.full_name || user.email}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-dark-gradient-start/50 transition rounded-lg mx-1"
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
                className="hidden md:flex items-center px-4 py-2 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-full hover:shadow-md hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 transition duration-300 transform hover:scale-105"
              >
                <FaGoogle className="mr-2" size={16} />
                <span>Sign in</span>
              </button>
            )
          )}
          <DarkModeToggle />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden rounded-lg p-1.5 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 border border-white/20 dark:border-dark-text/10 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-white transition duration-200"
            aria-label="Toggle mobile menu"
          >
            {isOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu - Compact version with height limit */}
      <div 
  ref={mobileMenuRef}
  className={`md:hidden transition-all duration-300 ease-in-out ${
    isOpen ? 'max-h-[60vh] opacity-100' : 'max-h-0 opacity-0'
  } overflow-hidden`}
>
        <div className="px-4 pt-3 pb-4 backdrop-blur-md bg-white/70 dark:bg-dark-profile-card/90 mx-3 my-2 rounded-xl shadow-lg border border-white/20 dark:border-dark-text/10">
          <div className="flex flex-col space-y-1">
            <NavLink href="/" active={pathname === '/'}>Home</NavLink>
            <NavLink href="/about" active={pathname === '/about'}>About</NavLink>
            <NavLink href="/clubs" active={pathname === '/clubs'}>Clubs</NavLink>
            <NavLink href="/news" active={pathname === '/news'}>News</NavLink>
            <NavLink href="/dashboard" active={pathname === '/dashboard'}>Dashboard</NavLink>
          </div>

          {!loading && !user && (
            <button
              onClick={handleGoogleSignIn}
              className="mt-3 w-full flex items-center justify-center py-2.5 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-lg hover:shadow-md transition duration-200"
            >
              <FaGoogle className="mr-2" size={16} />
              Sign in with UCI
            </button>
          )}

          {!loading && user && (
            <div className="mt-3 pt-2 border-t dark:border-gray-700/30">
              <div className="flex items-center space-x-3 mb-2">
                {user.user_metadata?.avatar_url ? (
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full opacity-75 blur-sm"></div>
                    <img 
                      src={user.user_metadata.avatar_url} 
                      className="relative h-10 w-10 rounded-full object-cover border-2 border-white dark:border-gray-800" 
                      alt="User avatar" 
                    />
                  </div>
                ) : (
                  <div className="rounded-full p-1.5 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 border border-white/20 dark:border-dark-text/10">
                    <FaUserCircle size={28} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{user.user_metadata.full_name || user.email}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center py-2 text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                <FaSignOutAlt className="mr-2" size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// Mobile navigation link component
function NavLink({ href, active, children }) {
  return (
    <Link 
      href={href} 
      className={`relative px-3 py-2 text-lg font-medium rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 pl-4'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/20'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
      )}
      {children}
    </Link>
  );
}