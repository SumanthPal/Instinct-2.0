import React from 'react';
import '../../../styles/globals.css';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import Link from 'next/link';

const About = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text overflow-hidden">
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24">
        {/* Hero Section */}
        <section className="mb-16 sm:mb-20 max-w-6xl mx-auto backdrop-blur-sm bg-white/20 dark:bg-dark-card/30 rounded-3xl border border-white/20 dark:border-dark-text/10 p-6 sm:p-10 shadow-xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 text-center">
            About Instinct
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-8 text-center leading-relaxed">
            Instinct helps UCI students discover and connect with the right clubs through automation, intelligent search, and a beautifully simple platform.
          </p>

          <div className="flex justify-center">
            <Link
              href="/about/technical"
              className="group inline-flex items-center space-x-2 text-lg sm:text-xl text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200 font-medium transform hover:translate-x-1"
            >
              <span>View Technical Details</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 transform group-hover:translate-x-1 transition-transform duration-300"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>
        </section>

        {/* Why Instinct */}
        <section className="mb-16 sm:mb-20 max-w-6xl mx-auto">
          <div className="flex items-center justify-center mb-8 sm:mb-10">
            <div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-12 sm:w-16 mr-4"></div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">Why Instinct?</h2>
            <div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-12 sm:w-16 ml-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px]">
              <h3 className="text-xl sm:text-2xl font-semibold mb-3 text-gray-900 dark:text-white">For Students</h3>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                UCI has hundreds of clubs—but no good way to find the ones that actually match your interests. Instinct makes this intuitive. We surface clubs by vibe, activity, and relevance. You can track real Instagram updates, find events, and get a feel for each org's personality.
              </p>
            </div>

            <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px]">
              <h3 className="text-xl sm:text-2xl font-semibold mb-3 text-gray-900 dark:text-white">For Clubs</h3>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                Instinct gives your org a platform where students are actually looking. We analyze social engagement and let you highlight what makes your club special. With smart scraping and effortless info updates, you'll never get overlooked again.
              </p>
            </div>
          </div>
        </section>

        {/* Our Team */}
        <section className="mb-16 sm:mb-20 max-w-6xl mx-auto backdrop-blur-sm bg-white/20 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 p-6 sm:p-10 shadow-md">
          <div className="flex items-center justify-center mb-8 sm:mb-10">
            <div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-12 sm:w-16 mr-4"></div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Meet the Creator</h2>
            <div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-12 sm:w-16 ml-4"></div>
          </div>

          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full opacity-75 group-hover:opacity-100 blur-sm transition duration-200"></div>
              <img
                src="/sumanth.jpg"
                alt="Sumanth Pallamreddy"
                className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover border-2 border-white dark:border-gray-800"
              />
            </div>
            <p className="mt-6 text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Sumanth Pallamreddy</p>
            <p className="text-base sm:text-lg text-gray-700 dark:text-gray-400">Founder • Developer • Engineer</p>

            <div className="mt-4 flex space-x-6">
              <a href="https://www.linkedin.com/in/sumanth-p-88271b239" target="_blank" rel="noopener noreferrer" className="transform transition-transform hover:scale-110">
                <FaLinkedin className="w-6 h-6 text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 transition-colors" />
              </a>
              <a href="https://github.com/SumanthPal" target="_blank" rel="noopener noreferrer" className="transform transition-transform hover:scale-110">
                <FaGithub className="w-6 h-6 text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors" />
              </a>
              <a href="https://x.com/lifeofsumpal_" target="_blank" rel="noopener noreferrer" className="transform transition-transform hover:scale-110">
                <FaXTwitter className="w-6 h-6 text-gray-900 dark:text-white hover:text-blue-500 transition-colors" />
              </a>
            </div>
          </div>
        </section>

        {/* DevOps & Bots */}
        <section className="mb-16 sm:mb-20 max-w-6xl mx-auto">
          <div className="flex items-center justify-center mb-8 sm:mb-10">
            <div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-12 sm:w-16 mr-4"></div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">DevOps & Operations</h2>
            <div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-12 sm:w-16 ml-4"></div>
          </div>

          <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
            {/* Queuetie */}
            <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 p-6 flex flex-col items-center max-w-xs shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px]">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                <span className="text-3xl sm:text-4xl font-bold text-white">Q</span>
              </div>
              <p className="mt-4 text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Queuetie</p>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 text-center">Task Orchestrator<br />and Queue Manager</p>
            </div>

            {/* Fixie Bixie */}
            <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 p-6 flex flex-col items-center max-w-xs shadow-md hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px]">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                <span className="text-3xl sm:text-4xl font-bold text-white">F</span>
              </div>
              <p className="mt-4 text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Fixie Bixie</p>
              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 text-center">Moderation Workflow<br />and Infrastructure Monitoring Bot</p>
            </div>
          </div>
        </section>

        <section className="mb-16 sm:mb-20 max-w-6xl mx-auto backdrop-blur-sm bg-white/20 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 p-6 sm:p-10 shadow-md">
          <div className="flex items-center justify-center mb-8 sm:mb-10">
            <div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-12 sm:w-16 mr-4"></div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Listen More About It</h2>
            <div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-12 sm:w-16 ml-4"></div>
          </div>
          <div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-md">
            <iframe 
              style={{borderRadius: "12px"}} 
              src="https://open.spotify.com/embed/episode/0xLs6q9TYf2Jmqv80ayH7r?utm_source=generator" 
              width="100%" 
              height="352" 
              frameBorder="0" 
              allowFullScreen="" 
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
              loading="lazy">
            </iframe>
          </div>
        </section>

        <section className="mb-16 sm:mb-20 max-w-6xl mx-auto">
          <div className="flex items-center justify-center mb-8 sm:mb-10">
            <div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-12 sm:w-16 mr-4"></div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">FAQs</h2>
            <div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-12 sm:w-16 ml-4"></div>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
            <details className="group backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-xl p-4 sm:p-5 shadow-md border border-white/20 dark:border-dark-text/10 hover:shadow-lg transition-all duration-300">
              <summary className="cursor-pointer text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
                <span className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                Is Instinct officially affiliated with UCI?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300 pl-7">
                No — Instinct is an independent student-led project built by UCI students for the UCI community.
              </p>
            </details>

            <details className="group backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-xl p-4 sm:p-5 shadow-md border border-white/20 dark:border-dark-text/10 hover:shadow-lg transition-all duration-300">
              <summary className="cursor-pointer text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
                <span className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                How often is club data updated?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300 pl-7">
                Club Instagram activity and metadata are refreshed regularly via an automated job queue and smart prioritization logic.
              </p>
            </details>

            <details className="group backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-xl p-4 sm:p-5 shadow-md border border-white/20 dark:border-dark-text/10 hover:shadow-lg transition-all duration-300">
              <summary className="cursor-pointer text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
                <span className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                Can clubs request changes to their profiles?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300 pl-7">
                Yes! A secure submission feature allows verified club officers to request updates. Validation is done via email and moderation tools.
              </p>
            </details>

            <details className="group backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-xl p-4 sm:p-5 shadow-md border border-white/20 dark:border-dark-text/10 hover:shadow-lg transition-all duration-300">
              <summary className="cursor-pointer text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
                <span className="mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                Is this open source?
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300 pl-7">
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