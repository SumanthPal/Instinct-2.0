import React from 'react';
import '../../../styles/globals.css';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { FaLinkedin, FaGithub, FaDiscord } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";
import Link from 'next/link';

const About = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="container mx-auto px-4 py-24 text-center">
        {/* Hero Section */}
        <div className="mb-16">
          <h1 className="text-6xl font-bold mb-6 text-gray-900 dark:text-dark-text">About Instinct</h1>
          <p className="text-2xl text-gray-700 dark:text-dark-subtext max-w-3xl mx-auto">
            Connecting UCI students with the perfect clubs through smart technology.
          </p>
          
          {/* Technical Details Link */}
          <div className="mt-8">
            <Link 
              href="/about/technical" 
              className="inline-flex items-center space-x-2 bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 text-white py-3 px-8 rounded-full transition-colors duration-300 text-lg"
            >
              <span>View Technical Details</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>
        
        {/* How to Use - For Students & Clubs */}
        <div className="max-w-4xl mx-auto mb-24">
          <h2 className="text-5xl font-bold mb-8 text-gray-900 dark:text-dark-text">Why Instinct?</h2>

          {/* For Students */}
          <div className="mb-12">
            <h3 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-dark-text">For Students</h3>
            <p className="text-2xl text-gray-700 dark:text-dark-subtext">
              Let's be real—UCI has tons of clubs, but there's never really been a platform that makes it easy or intuitive to actually follow and keep up with them. Instinct cuts through the noise. You can explore clubs by vibe (a.k.a. categories and smart search), see what they're really up to through Instagram, and even filter by how active they are. It's basically your club radar for finding the ones that match your energy.
            </p>
          </div>

          {/* For Clubs */}
          <div>
            <h3 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-dark-text">For Clubs</h3>
            <p className="text-2xl text-gray-700 dark:text-dark-subtext">
              Clubs, we got you. Instinct gives your org visibility beyond random flyer drops. We track engagement from your socials (don't worry, no creepy stuff), so students can discover you when you're active and doing cool things. The more consistent and creative your presence, the more you stand out—and we make it easy to update your info too.
            </p>
          </div>
        </div>

        {/* Our Team Section */}
        <div className="mb-24">
          <h2 className="text-5xl font-bold mb-12 text-center text-gray-900 dark:text-dark-text">Our Team</h2>

          {/* Founder Section */}
          <div className="flex flex-col items-center mb-24">
            <img src="/sumanth.jpg" alt="Sumanth Pallamreddy" className="w-32 h-32 rounded-full object-cover object-center transform transition-all duration-300 hover:scale-110" />
            <p className="mt-6 text-2xl font-semibold text-gray-900 dark:text-dark-text">Sumanth Pallamreddy</p>
            <p className="text-lg text-gray-700 dark:text-dark-subtext">Founder | Developer | Engineer</p>

            {/* Social Links */}
            <div className="mt-4 flex space-x-6">
              <a href="https://www.linkedin.com/in/sumanth-p-88271b239" target="_blank" rel="noopener noreferrer">
                <FaLinkedin className="w-6 h-6 text-gray-900 dark:text-dark-text hover:text-blue-700 dark:hover:text-blue-500" />
              </a>
              <a href="https://github.com/SumanthPal" target="_blank" rel="noopener noreferrer">
                <FaGithub className="w-6 h-6 text-gray-900 dark:text-dark-text hover:text-gray-700 dark:hover:text-gray-200" />
              </a>
              <a href="https://x.com/lifeofsumpal_" target="_blank" rel="noopener noreferrer">
                <FaXTwitter className="w-6 h-6 text-gray-900 dark:text-dark-text hover:text-gray-700 dark:hover:text-gray-200" />
              </a>
            </div>
          </div>

          {/* DevOps & Operations Section */}
          <div>
            <h3 className="text-4xl font-bold mb-12 text-center text-gray-900 dark:text-dark-text">DevOps & Operations</h3>

            <div className="flex flex-wrap justify-center gap-16">
              {/* Bot 1 */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">Q</span>
                </div>
                <p className="mt-4 text-2xl font-semibold text-gray-900 dark:text-dark-text">Queuetie</p>
                <p className="text-center text-lg text-gray-700 dark:text-dark-subtext">Task Orchestrator<br />and Queue Manager</p>
              </div>

              {/* Bot 2 */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">F</span>
                </div>
                <p className="mt-4 text-2xl font-semibold text-gray-900 dark:text-dark-text">Fixie Bixie</p>
                <p className="text-center text-lg text-gray-700 dark:text-dark-subtext">Moderation Workflow<br />and Infrastructure Monitoring Bot</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;