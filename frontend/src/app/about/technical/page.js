import React from 'react';
import '../../../../styles/globals.css';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { 
  SiNextdotjs, 
  SiTailwindcss, 
  SiRedis, 
  SiSupabase, 
  SiFastapi, 
  SiSelenium,
  SiVercel,
  SiCloudflare,
  SiPython,
  SiGoogle,
  SiPostgresql,
  SiJavascript,
  SiDocker,
  SiGithubactions
} from 'react-icons/si';
import { FaGithub, FaReact, FaPython, FaSearch, FaInstagram, FaServer } from 'react-icons/fa';
import { RiOpenaiFill } from 'react-icons/ri';
import Link from 'next/link';

const TechnicalAbout = () => {
  // Group technologies by category for better organization
  const technologies = [
    {
      category: "Frontend",
      tools: [
        { icon: <SiNextdotjs />, name: "Next.js", description: "Next.js 16 with the App Router and React 19, installable as a PWA via Serwist." },
        { icon: <SiTailwindcss />, name: "TailwindCSS", description: "Tailwind CSS 4 for styling, with a few Radix UI primitives for dialogs and popovers." },
        { icon: <SiJavascript />, name: "JavaScript", description: "The frontend is plain JavaScript, linted with Biome." },
      ]
    },
    {
      category: "Backend",
      tools: [
        { icon: <SiFastapi />, name: "FastAPI", description: "The REST API. Routes are plain sync functions run on FastAPI's threadpool." },
        { icon: <SiPython />, name: "Python", description: "The API, scraper, and event parser are all Python." },
        { icon: <SiRedis />, name: "Redis", description: "Holds the scrape job queue that the daily rotation feeds." },
        { icon: <SiSelenium />, name: "Selenium", description: "Drives the Instagram scraper that collects club profiles and posts." },
      ]
    },
    {
      category: "Database & Auth",
      tools: [
        { icon: <SiSupabase />, name: "Supabase", description: "Hosted Postgres plus authentication for sign-in." },
        { icon: <SiPostgresql />, name: "PostgreSQL", description: "Full-text search with tsvector columns and pg_trgm for typo-tolerant matching." },
        { icon: <SiGoogle />, name: "Google", description: "Google sign-in through Supabase Auth, limited to @uci.edu accounts." },
        { icon: <RiOpenaiFill />, name: "OpenAI", description: "Structured-output parsing turns post captions into events (gpt-6-luna)." },
      ]
    },
    {
      category: "DevOps & Deployment",
      tools: [
        { icon: <SiVercel />, name: "Vercel", description: "Next.js frontend hosted on Vercel." },
        { icon: <FaServer />, name: "Heroku", description: "FastAPI backend API hosted on Heroku." },
        { icon: <SiCloudflare />, name: "Cloudflare R2", description: "Object storage for club profile pictures and post media." },
        { icon: <SiDocker />, name: "Docker", description: "The API and the scraper each have their own Docker image." },
        { icon: <SiGithubactions />, name: "GitHub Actions", description: "CI runs backend lint and tests plus the frontend lint and build on every push and pull request; a deploy workflow ships the API to Heroku." },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12 md:pt-28 md:pb-20">
        {/* Hero Section */}
        <div className="max-w-6xl mx-auto mb-20 bg-card rounded-md border border-border p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground text-left sm:text-center mb-6">
            Technical Details
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-center text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            The technology powering Instinct's platform for UCI club discovery.
          </p>

          {/* Back to About Link */}
          <div className="mt-8 flex justify-center">
            <Link
              href="/about"
              className="group inline-flex items-center space-x-2 text-xl text-foreground hover:text-foreground transition-colors duration-200 font-medium"
            >
              <span>← Back to About</span>
            </Link>
          </div>
        </div>
        
        {/* System Overview Section */}
        <div className="max-w-6xl mx-auto mb-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            System Overview
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Instinct helps UC Irvine students find clubs and events. It currently indexes 451 clubs,
            refreshes them from Instagram every day, and turns their posts into a searchable
            directory and event calendar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            
            {/* Frontend */}
            <div className="bg-card p-6 rounded-md border border-border">
              <div className="flex items-center mb-4">
                <FaReact className="text-3xl text-foreground mr-3" />
                <h3 className="text-2xl font-semibold text-foreground">Frontend</h3>
              </div>
              <ul className="text-muted-foreground space-y-2 text-lg pl-2">
                <li>• Next.js 16, React 19, and Tailwind CSS 4 on Vercel</li>
                <li>• Club directory, club pages, events calendar, and news</li>
                <li>• Installable as a PWA (Serwist service worker)</li>
                <li>• Google OAuth (restricted to @uci.edu)</li>
              </ul>
            </div>

            {/* Backend */}
            <div className="bg-card p-6 rounded-md border border-border">
              <div className="flex items-center mb-4">
                <FaPython className="text-3xl text-blue-600 dark:text-blue-400 mr-3" />
                <h3 className="text-2xl font-semibold text-foreground">Backend</h3>
              </div>
              <ul className="text-muted-foreground space-y-2 text-lg pl-2">
                <li>• FastAPI (Python) on Heroku, built from a Docker image</li>
                <li>• Sync routes running on FastAPI's threadpool</li>
                <li>• Serves clubs, posts, events, search, and calendar feeds</li>
                <li>• Supabase Postgres as the database</li>
              </ul>
            </div>

            {/* Search System */}
            <div className="bg-card p-6 rounded-md border border-border">
              <div className="flex items-center mb-4">
                <FaSearch className="text-3xl text-green-600 dark:text-green-400 mr-3" />
                <h3 className="text-2xl font-semibold text-foreground">Search System</h3>
              </div>
              <ul className="text-muted-foreground space-y-2 text-lg pl-2">
                <li>• Postgres full-text search over club name, handle, and description</li>
                <li>• Prefix matching as you type, with pg_trgm as a typo fallback</li>
                <li>• Also matches post captions and event text, refreshed after each scrape</li>
              </ul>
            </div>

            {/* Scraper System */}
            <div className="bg-card p-6 rounded-md border border-border">
              <div className="flex items-center mb-4">
                <FaInstagram className="text-3xl text-pink-600 dark:text-pink-400 mr-3" />
                <h3 className="text-2xl font-semibold text-foreground">Scraper System</h3>
              </div>
              <ul className="text-muted-foreground space-y-2 text-lg pl-2">
                <li>• Daily Selenium scrape of club accounts, in rotation</li>
                <li>• Redis job queue feeds the scraper</li>
                <li>• Images stored on Cloudflare R2</li>
                <li>• OpenAI parser extracts events from captions, in LA time</li>
              </ul>
            </div>

          </div>
        </div>


        {/* Technical Details Section - Tech Stack */}
        <div className="max-w-6xl mx-auto mb-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            Our Tech Stack
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Here's what Instinct runs on today:
          </p>

          {/* Tech Categories */}
          <div className="space-y-16">
            {technologies.map((techCategory, index) => (
              <div key={index} className="bg-card/50 rounded-xl border border-border p-6 shadow-md">
                <h3 className="text-2xl font-bold mb-8 text-foreground">
                  {techCategory.category}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                  {techCategory.tools.map((tool, toolIndex) => (
                    <div
                      key={toolIndex}
                      className="relative p-4 flex flex-col items-center justify-center text-center group bg-card/70 rounded-lg border border-border shadow-xs hover:shadow-md transition duration-300"
                    >
                      <div className="text-4xl mb-3 text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                        {tool.icon}
                      </div>
                      <span className="text-base font-semibold text-foreground mb-1">
                        {tool.name}
                      </span>
                      
                      {/* Mobile-friendly description - Always visible on small screens */}
                      <p className="md:hidden text-xs text-muted-foreground mt-2 leading-tight">
                        {tool.description}
                      </p>
                      
                      {/* Desktop tooltip - Only shows on hover */}
                      <div className="hidden md:block absolute left-1/2 top-full z-20 w-64 -translate-x-1/2 rounded-md bg-popover text-popover-foreground px-4 py-3 shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-border pointer-events-none mt-2">
                        <p className="text-sm leading-relaxed">{tool.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Cloud Infrastructure */}
        <div className="max-w-6xl mx-auto mb-20 bg-card/60 rounded-xl border border-border p-6 sm:p-8 shadow-md">
          <h2 className="text-3xl font-bold mb-8 text-foreground text-center">Cloud Infrastructure</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-card/60 rounded-lg border border-border p-4 text-center flex flex-col items-center justify-center hover:shadow-md transition-all duration-300">
              <div className="text-5xl text-blue-600 dark:text-blue-400 mb-4 hover:text-blue-500 dark:hover:text-blue-300 transition-colors duration-300">
                <FaServer />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Heroku API</h3>
              <p className="text-muted-foreground text-sm">
                FastAPI backend deployed on Heroku
              </p>
            </div>
            
            <div className="bg-card/60 rounded-lg border border-border p-4 text-center flex flex-col items-center justify-center hover:shadow-md transition-all duration-300">
              <div className="text-5xl text-green-600 dark:text-green-400 mb-4 hover:text-green-500 dark:hover:text-green-300 transition-colors duration-300">
                <SiDocker />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Containerization</h3>
              <p className="text-muted-foreground text-sm">
                Separate Docker images for the API and the scraper
              </p>
            </div>
            
            <div className="bg-card/60 rounded-lg border border-border p-4 text-center flex flex-col items-center justify-center hover:shadow-md transition-all duration-300">
              <div className="text-5xl text-purple-600 dark:text-purple-400 mb-4 hover:text-purple-500 dark:hover:text-purple-300 transition-colors duration-300">
                <SiGithubactions />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">CI/CD Pipeline</h3>
              <p className="text-muted-foreground text-sm">
                Lint, tests, and frontend build on every push and PR; deploys the API to Heroku
              </p>
            </div>
          </div>
        </div>
        
        {/* System Architecture */}
        <div className="max-w-6xl mx-auto mb-20 bg-card/60 rounded-xl border border-border p-6 sm:p-8 shadow-md">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-foreground text-center">
            System Architecture
          </h2>

          {/* Diagram */}
          <div className="w-full flex justify-center mb-8 overflow-x-auto bg-card/60 rounded-lg border border-border p-4">
            <img src="/diagram.svg" alt="System Architecture Diagram" className="w-full max-w-4xl h-auto" />
          </div>

          {/* Description */}
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Instinct is a Next.js frontend on Vercel talking to a FastAPI backend on Heroku, with Supabase (Postgres),
            a Redis job queue, Cloudflare R2 for images, and a Selenium scraper that refreshes club Instagram data daily.
          </p>

          {/* Key Components */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-foreground">Key Components:</h3>
            <ul className="space-y-2 text-muted-foreground text-base pl-4 list-disc">
              <li><strong>Client Layer:</strong> Next.js frontend deployed on Vercel</li>
              <li><strong>API Layer:</strong> FastAPI on Heroku</li>
              <li><strong>Data Layer:</strong> Supabase Postgres with full-text and trigram search</li>
              <li><strong>Task Layer:</strong> Daily scrape rotation via a Redis queue; OpenAI event parsing</li>
              <li><strong>Storage Layer:</strong> Cloudflare R2 for profile and post images</li>
            </ul>
          </div>
        </div>

        {/* In Progress/Future Section */}
        <div className="max-w-6xl mx-auto mb-20 bg-card/60 rounded-xl border border-border p-6 sm:p-8 shadow-md">
          <h2 className="text-3xl font-bold mb-8 text-foreground text-center">
            In Progress & Coming Soon
          </h2>

          <div className="space-y-4 text-muted-foreground text-base">
            {[
              "Making the scraper faster and more reliable",
              "Improving event extraction from captions",
              "Ongoing frontend polish"
            ].map((item, idx) => (
              <div key={idx} className="flex items-start bg-card/60 rounded-lg p-3 border border-border">
                <span className="inline-block mr-3 mt-0.5 text-yellow-600 dark:text-yellow-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span className="flex-1">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TechnicalAbout;