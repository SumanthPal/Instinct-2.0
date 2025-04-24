import React from 'react';
import '../../styles/globals.css';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { SiNextdotjs, SiTailwindcss, SiRedis, SiSupabase, SiFastapi, SiSelenium } from 'react-icons/si';
import { FaLinkedin, FaGithub, FaTwitter } from 'react-icons/fa';
import { SiHeroku, SiVercel, SiPython, SiGoogle, SiOpenai } from 'react-icons/si'; // Added new icons

const About = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="container mx-auto px-4 py-24 text-center">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <h1 className="text-5xl font-bold mb-6 text-gray-900 dark:text-dark-text">About Instinct</h1>
          <p className="text-2xl text-gray-700 dark:text-dark-subtext mb-8">
            With so many clubs at UC Irvine, discovering and engaging with them can be tough. That’s why we created Instinct: to make club exploration simple and accessible for all students.
          </p>
        </div>

        {/* Our Team Section */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-dark-text">Our Team</h2>
          <div className="flex justify-center gap-16">
            <div className="flex flex-col items-center">
              <img src="/sumanth.jpg" alt="Sumanth Pallamreddy" className="w-24 h-24 rounded-full object-cover object-center transform transition-all duration-300 hover:scale-110" />
              <p className="mt-4 text-xl font-semibold text-gray-900 dark:text-dark-text">Sumanth Pallamreddy</p>
              <p className="text-lg text-gray-700 dark:text-dark-subtext">Founder & Developer</p>
              {/* Social Links */}
              <div className="mt-4 flex space-x-6">
                <a href="https://www.linkedin.com/in/yourprofile" target="_blank" rel="noopener noreferrer">
                  <FaLinkedin className="w-6 h-6 text-gray-900 dark:text-dark-text hover:text-blue-700 dark:hover:text-blue-500" />
                </a>
                <a href="https://github.com/yourprofile" target="_blank" rel="noopener noreferrer">
                  <FaGithub className="w-6 h-6 text-gray-900 dark:text-dark-text hover:text-black dark:hover:text-gray-200" />
                </a>
                <a href="https://twitter.com/yourprofile" target="_blank" rel="noopener noreferrer">
                  <FaTwitter className="w-6 h-6 text-gray-900 dark:text-dark-text hover:text-blue-400 dark:hover:text-blue-300" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details Section */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-dark-text">Technical Details</h2>
          <p className="text-xl text-gray-700 dark:text-dark-subtext mb-8">
            Instinct is powered by the following technologies:
          </p>
          {/* Responsive Grid Layout for Logos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-12 max-w-4xl mx-auto">
            {/* Existing technologies */}
            <div className="flex items-center space-x-4 justify-center">
              <SiNextdotjs className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Next.js</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiTailwindcss className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">TailwindCSS</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiRedis className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Redis</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiFastapi className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">FastAPI</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiSupabase className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Supabase</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiSelenium className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Selenium</span>
            </div>
            {/* New technologies */}
            <div className="flex items-center space-x-4 justify-center">
              <SiHeroku className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Heroku</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiVercel className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Vercel</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiPython className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Python</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiGoogle className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Google</span>
            </div>
            <div className="flex items-center space-x-4 justify-center">
              <SiOpenai className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">OpenAI</span>
            </div>
          </div>
        </div>

        {/* Disclaimer Section */}
        <div className="mb-12 text-lg text-gray-700 dark:text-dark-subtext">
          <p>
            Instinct is not affiliated with or endorsed by the University of California, Irvine.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
