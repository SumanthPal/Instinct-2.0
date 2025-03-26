"use client";

import { useState } from 'react';
import Link from 'next/link';
import DarkModeToggle from './DarkModeToggle';
import { FaBars, FaTimes } from 'react-icons/fa';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full  bg-transparent backdrop-blur-sm z-50 ">
      <div className="w-full px-8 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img src="/logo.svg" alt="Logo" className="h-12 w-12 space-x-8" />
            <span className="text-5xl font-bold text-gray-900 dark:text-white">
              Instinct
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-3xl text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/about" className="text-3xl text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors">
              About
            </Link>
            <button className="text-3xl text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors">
              Clubs
            </button>
            <DarkModeToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
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
              <button className="block w-full text-left px-3 py-2 text-3xl text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors">
                Clubs
              </button>
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