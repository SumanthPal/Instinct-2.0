import React from 'react';
import '../../styles/globals.css';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { FaReact, FaPython, FaDatabase } from 'react-icons/fa';
import { SiNextdotjs, SiTailwindcss, SiFlask, SiPostgresql } from 'react-icons/si';

const About = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h1 className="text-6xl font-bold mb-6 text-gray-900 dark:text-dark-text">
            About Instinct
          </h1>
          <p className="text-xl text-gray-700 dark:text-dark-subtext mb-8">
            Instinct was created as a passion project by Sumanth Pallamreddy, a freshman at UC Irvine. Frustrated with the constant need to check Instagram for club events and information, Sumanth envisioned a centralized platform to simplify student life. Instinct was born to make it easier for students to discover clubs, stay updated on events, and connect with their campus community.
          </p>
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Tech Stack Card */}
          <div className="bg-white dark:bg-dark-card p-8 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-dark-text">
              Tech Stack
            </h2>
            <ul className="space-y-4 text-left">
              {/* Next.js */}
              <li className="flex items-center space-x-4">
                <SiNextdotjs className="w-8 h-8 text-gray-900 dark:text-dark-text" />
                <span className="text-xl text-gray-700 dark:text-dark-text">Next.js</span>
              </li>
              {/* TailwindCSS */}
              <li className="flex items-center space-x-4">
                <SiTailwindcss className="w-8 h-8 text-gray-900 dark:text-dark-text" />
                <span className="text-xl text-gray-700 dark:text-dark-text">TailwindCSS</span>
              </li>
              {/* Python */}
              <li className="flex items-center space-x-4">
                <FaPython className="w-8 h-8 text-gray-900 dark:text-dark-text" />
                <span className="text-xl text-gray-700 dark:text-dark-text">Python</span>
              </li>
              {/* Flask */}
              <li className="flex items-center space-x-4">
                <SiFlask className="w-8 h-8 text-gray-900 dark:text-dark-text" />
                <span className="text-xl text-gray-700 dark:text-dark-text">Flask</span>
              </li>
              {/* SQL */}
              <li className="flex items-center space-x-4">
                <FaDatabase className="w-8 h-8 text-gray-900 dark:text-dark-text" />
                <span className="text-xl text-gray-700 dark:text-dark-text">SQL</span>
              </li>
            </ul>
          </div>

          {/* Vision Card */}
          <div className="bg-white dark:bg-dark-card p-8 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-dark-text">
              Our Vision
            </h2>
            <p className="text-gray-700 dark:text-dark-text">
              We envision a campus experience where students can effortlessly discover and engage with clubs and events. Instinct aims to bridge the gap between students and organizations, fostering a more connected and vibrant campus community.
            </p>
          </div>

          {/* Values Card */}
          <div className="bg-white dark:bg-dark-card p-8 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-dark-text">
              Our Values
            </h2>
            <p className="text-gray-700 dark:text-dark-text">
              At Instinct, we value <strong>simplicity</strong>, <strong>innovation</strong>, and <strong>inclusivity</strong>. We are committed to creating a platform that is easy to use, forward-thinking, and accessible to all students, regardless of their background or technical expertise.
            </p>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-dark-text">
            How to Use Instinct
          </h2>
          <p className="text-xl text-gray-700 dark:text-dark-subtext mb-8">
            Instinct is designed to be intuitive and user-friendly. Here’s how you can make the most of it:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-dark-text">
                Discover Clubs
              </h3>
              <p className="text-gray-700 dark:text-dark-text">
                Browse through a comprehensive list of clubs at your school. Filter by categories, interests, or event dates to find what matters to you.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-dark-text">
                Stay Updated
              </h3>
              <p className="text-gray-700 dark:text-dark-text">
                Never miss an event again. Instinct provides up-to-date information on club meetings, socials, and other activities.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-dark-text">
                Connect Easily
              </h3>
              <p className="text-gray-700 dark:text-dark-text">
                Instinct links you directly to club social media pages and websites, making it easy to get involved and stay connected.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;