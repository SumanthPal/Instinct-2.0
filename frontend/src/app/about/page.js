import React from 'react';
import '../../../styles/globals.css';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { SiNextdotjs, SiTailwindcss, SiRedis, SiSupabase, SiFastapi, SiSelenium } from 'react-icons/si';
import { FaLinkedin, FaGithub, FaTwitter, FaDiscord } from 'react-icons/fa';
import { SiHeroku, SiVercel, SiPython, SiGoogle, SiOpenai, SiPostgresql } from 'react-icons/si'; // Added new icons

const About = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="container mx-auto px-4 py-24 text-center">
        {/* Hero Section */}
        
        {/* How to Use - For Students & Clubs */}
        <div className="max-w-4xl mx-auto mb-24 ">
          <h2 className="text-5xl font-bold mb-8 text-gray-900 dark:text-dark-text">Why Instinct?</h2>

          {/* For Students */}
          <div className="mb-12">
            <h3 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-dark-text">For Students</h3>
            <p className="text-2xl text-gray-700 dark:text-dark-subtext">
            Let’s be real—UCI has tons of clubs, but there’s never really been a platform that makes it easy or intuitive to actually follow and keep up with them. Instinct cuts through the noise. You can explore clubs by vibe (a.k.a. categories and smart search), see what they’re really up to through Instagram, and even filter by how active they are. It’s basically your club radar for finding the ones that match your energy.

</p>
          </div>

          {/* For Clubs */}
          <div>
            <h3 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-dark-text">For Clubs</h3>
            <p className="text-2xl text-gray-700 dark:text-dark-subtext">
              Clubs, we got you. Instinct gives your org visibility beyond random flyer drops. We track engagement from your socials (don’t worry, no creepy stuff), so students can discover you when you're active and doing cool things. The more consistent and creative your presence, the more you stand out—and we make it easy to update your info too.
            </p>
          </div>
        </div>


        {/* Our Team Section */}
        <div className="mb-16">
          <h2 className="text-5xl font-bold mb-6 text-gray-900 dark:text-dark-text">Our Team</h2>
          <div className="flex justify-center gap-16">
            <div className="flex flex-col items-center">
              <img src="/sumanth.jpg" alt="Sumanth Pallamreddy" className="w-24 h-24 rounded-full object-cover object-center transform transition-all duration-300 hover:scale-110" />
              <p className="mt-4 text-2xl font-semibold text-gray-900 dark:text-dark-text">Sumanth Pallamreddy</p>
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
            <div className="relative group flex items-center space-x-4 justify-center">
            <SiNextdotjs className="w-8 h-8 text-gray-900 dark:text-dark-text" />
            <span className="text-xl text-gray-700 dark:text-dark-text">Next.js</span>
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              We use Next.js for fast routing, dynamic pages, and seamless full-stack React development.
            </div>
          </div>
          <div className="relative group flex items-center space-x-4 justify-center">
            
          <SiTailwindcss className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">TailwindCSS</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              TailwindCSS is used for the awesome/handmade styling of our components.
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiRedis className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Redis</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Redis is used for storage of our job priority queues. (Don't have enough money for caching unfortunetly. 😭)
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiFastapi className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">FastAPI</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              FastAPI is our choice for integration of the RESTful API.
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiSupabase className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Supabase</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Supabase is our database choice for authentication, relational mapping, and semantic search.
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiSelenium className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Selenium</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Can't really say why I use this...
              </div>
            </div>
            {/* New technologies */}
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiHeroku className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Heroku</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Our backend is hosted on Heroku with four Dynos. (I need more money for compute 😭)
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiVercel className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Vercel</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Paas of choice.
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiPython className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Python</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Language our backend is written in. 
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiGoogle className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Google</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Used for simple OAuth.
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiOpenai className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">OpenAI</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              We use OpenAI to help with semantic/smart search and NLP processing.
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <SiPostgresql className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">PostgresSQL</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Schema language of choice for the database.
              </div>
            </div>
            <div className="relative group flex items-center space-x-4 justify-center">
              <FaDiscord className="w-8 h-8 text-gray-900 dark:text-dark-text" />
              <span className="text-xl text-gray-700 dark:text-dark-text">Discord</span>
              <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Our choice for monitoring system health, logs, and user requests.
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer Section */}
       
      </main>

      <Footer />
    </div>
  );
};

export default About;
