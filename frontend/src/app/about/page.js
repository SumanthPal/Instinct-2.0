import React from 'react';
import '../../../styles/globals.css';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import Link from 'next/link';

const About = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />

      <main className="container mx-auto px-4 py-24 text-center">
        {/* Hero Section */}
        <section className="mb-24">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white tracking-tight">
            About Instinct
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-10">
            Instinct helps UCI students discover and connect with the right clubs through automation, intelligent search, and a beautifully simple platform.
          </p>

          <div className="mt-10 flex justify-center">
    <Link
      href="/about/technical"
      className="group inline-flex items-center space-x-2 text-2xl text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200 font-medium"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-8 w-8 transform group-hover:-translate-x-1 transition-transform duration-300"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      <span>To Technical</span>
    </Link>
  </div>
        </section>

        {/* Why Instinct */}
        <section className="mb-32">
          <h2 className="text-4xl md:text-5xl font-bold mb-16 text-gray-900 dark:text-white">Why Instinct?</h2>

          <div className="space-y-16 max-w-4xl mx-auto text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
            <div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">For Students</h3>
              <p>
                UCI has hundreds of clubs—but no good way to find the ones that actually match your interests. Instinct makes this intuitive. We surface clubs by vibe, activity, and relevance. You can track real Instagram updates, find events, and get a feel for each org’s personality.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">For Clubs</h3>
              <p>
                Instinct gives your org a platform where students are actually looking. We analyze social engagement and let you highlight what makes your club special. With smart scraping and effortless info updates, you’ll never get overlooked again.
              </p>
            </div>
          </div>
        </section>

        {/* Our Team */}
        <section className="mb-32">
          <h2 className="text-4xl md:text-5xl font-bold mb-16 text-gray-900 dark:text-white">Meet the Creator</h2>

          <div className="flex flex-col items-center">
            <img
              src="/sumanth.jpg"
              alt="Sumanth Pallamreddy"
              className="w-32 h-32 rounded-full object-cover shadow-md hover:scale-105 transition-transform duration-300"
            />
            <p className="mt-6 text-2xl font-semibold text-gray-900 dark:text-white">Sumanth Pallamreddy</p>
            <p className="text-lg text-gray-700 dark:text-gray-400">Founder • Developer • Engineer</p>

            <div className="mt-4 flex space-x-6">
              <a href="https://www.linkedin.com/in/sumanth-p-88271b239" target="_blank" rel="noopener noreferrer">
                <FaLinkedin className="w-6 h-6 text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 transition-colors" />
              </a>
              <a href="https://github.com/SumanthPal" target="_blank" rel="noopener noreferrer">
                <FaGithub className="w-6 h-6 text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors" />
              </a>
              <a href="https://x.com/lifeofsumpal_" target="_blank" rel="noopener noreferrer">
                <FaXTwitter className="w-6 h-6 text-gray-900 dark:text-white hover:text-blue-500 transition-colors" />
              </a>
            </div>
          </div>
        </section>

        {/* DevOps & Bots */}
        <section className="mb-32">
          <h2 className="text-4xl md:text-5xl font-bold mb-16 text-gray-900 dark:text-white">DevOps & Operations</h2>

          <div className="flex flex-wrap justify-center gap-12 text-center">
            {/* Queuetie */}
            <div className="flex flex-col items-center max-w-xs">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                <span className="text-4xl font-bold text-white">Q</span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">Queuetie</p>
              <p className="text-lg text-gray-700 dark:text-gray-300">Task Orchestrator<br />and Queue Manager</p>
            </div>

            {/* Fixie Bixie */}
            <div className="flex flex-col items-center max-w-xs">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                <span className="text-4xl font-bold text-white">F</span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">Fixie Bixie</p>
              <p className="text-lg text-gray-700 dark:text-gray-300">Moderation Workflow<br />and Infrastructure Monitoring Bot</p>
            </div>
          </div>
        </section>

        <section className="mb-32">
          <h2 className="text-4xl md:text-5xl font-bold mb-12 text-gray-900 dark:text-white">FAQs</h2>
          <div className="max-w-3xl mx-auto space-y-6 text-left">
            <details className="group bg-white/70 dark:bg-dark-profile-card rounded-xl p-5 shadow-md">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 transition-colors">
                Is Instinct officially affiliated with UCI?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300">
                No — Instinct is an independent student-led project built by UCI students for the UCI community.
              </p>
            </details>

            <details className="group bg-white/70 dark:bg-dark-profile-card rounded-xl p-5 shadow-md">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 transition-colors">
                How often is club data updated?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300">
                Club Instagram activity and metadata are refreshed regularly via an automated job queue and smart prioritization logic.
              </p>
            </details>

            <details className="group bg-white/70 dark:bg-dark-profile-card rounded-xl p-5 shadow-md">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 transition-colors">
                Can clubs request changes to their profiles?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300">
                Yes! A secure submission feature allows verified club officers to request updates. Validation is done via email and moderation tools.
              </p>
            </details>

            <details className="group bg-white/70 dark:bg-dark-profile-card rounded-xl p-5 shadow-md">
              <summary className="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 transition-colors">
                Is this open source?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300">
                Unfortunately, no, but if you're interested in learning more about the project or contributing, let me know!
              </p>
            </details>
          </div>
          </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
