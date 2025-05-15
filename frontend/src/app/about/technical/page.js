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
  SiPython,
  SiGoogle,
  SiOpenai,
  SiPostgresql,
  SiJavascript,
  SiDocker,
  SiGithubactions,
  SiTypescript
} from 'react-icons/si';
import { FaGithub, FaDiscord } from 'react-icons/fa';
import { FaReact, FaPython, FaSearch, FaInstagram } from 'react-icons/fa';
import { VscAzure } from 'react-icons/vsc';
import Link from 'next/link';

const TechnicalAbout = () => {
  // Group technologies by category for better organization
  const technologies = [
    {
      category: "Frontend",
      tools: [
        { icon: <SiNextdotjs />, name: "Next.js", description: "We use Next.js for fast routing, dynamic pages, and seamless full-stack React development." },
        { icon: <SiTailwindcss />, name: "TailwindCSS", description: "TailwindCSS is used for the awesome/handmade styling of our components." },
        { icon: <SiJavascript />, name: "JavaScript", description: "Language of choice used for our frontend." },
        { icon: <SiTypescript />, name: "TypeScript", description: "Added for type safety and improved developer experience." },
      ]
    },
    {
      category: "Backend",
      tools: [
        { icon: <SiFastapi />, name: "FastAPI", description: "FastAPI is our choice for integration of the RESTful API." },
        { icon: <SiPython />, name: "Python", description: "Language our backend is written in." },
        { icon: <SiRedis />, name: "Redis", description: "Redis is used for storage of our job priority queues. (Don't have enough money for caching unfortunately. 😭)" },
        { icon: <SiSelenium />, name: "Selenium", description: "Used for web scraping and automation of data gathering from club sources." },
      ]
    },
    {
      category: "Database & Auth",
      tools: [
        { icon: <SiSupabase />, name: "Supabase", description: "Supabase is our database choice for authentication, relational mapping, and semantic search." },
        { icon: <SiPostgresql />, name: "PostgreSQL", description: "Schema language of choice for the database." },
        { icon: <SiGoogle />, name: "Google", description: "Used for simple OAuth." },
        { icon: <SiOpenai />, name: "OpenAI", description: "We use OpenAI to help with semantic/smart search and NLP processing." },
      ]
    },
    {
      category: "DevOps & Deployment",
      tools: [
        { icon: <SiVercel />, name: "Vercel", description: "PaaS of choice for frontend deployment." },
        { icon: <VscAzure />, name: "Azure", description: "Hardest thing I've done in my life" },
        { icon: <SiDocker />, name: "Docker", description: "Containerization to ensure consistent environments across development and production." },
        { icon: <SiGithubactions />, name: "GitHub Actions", description: "Automated CI/CD pipelines for testing, building, and deployment." },
        { icon: <FaDiscord />, name: "Discord", description: "Our choice for monitoring system health, logs, and user requests." },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="container mx-auto px-4 py-16 md:py-24">
        {/* Hero Section */}
        <div className="mb-24 px-4 sm:px-6 lg:px-8">
  <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-center mb-6 text-gray-900 dark:text-white tracking-tight">
    Technical Details
  </h1>

  <p className="text-lg sm:text-xl md:text-2xl text-center text-gray-700 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
    The technology powering Instinct's platform for UCI club discovery.
  </p>

  {/* Back to About Link */}
  <div className="mt-10 flex justify-center">
    <Link
      href="/about"
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
      <span>Back to About</span>
    </Link>
  </div>
</div>

        
        {/* System Overview Section */}
        <div className="mb-32 px-4 sm:px-6 lg:px-8 text-center">
  <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-900 dark:text-white">
    System Overview
  </h2>
  <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-16 max-w-3xl mx-auto leading-relaxed">
    Instinct is a full-stack web application designed to help UC Irvine students discover and follow campus clubs.
    The platform aggregates club data (especially from Instagram), enables powerful search capabilities, and displays
    detailed club profiles and events.
  </p>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto text-left">
    
    {/* Frontend */}
    <div className="bg-white dark:bg-dark-profile-card p-6 rounded-2xl shadow-md hover:shadow-xl transition duration-300">
      <div className="flex items-center mb-4">
        <FaReact className="text-3xl text-indigo-600 dark:text-indigo-400 mr-3" />
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Frontend</h3>
      </div>
      <ul className="text-gray-700 dark:text-gray-300 space-y-2 text-lg pl-2">
        <li>• Built with Next.js and Tailwind CSS</li>
        <li>• Responsive design for all device sizes</li>
        <li>• Landing, about, clubs list, and dynamic club pages</li>
        <li>• Google OAuth (restricted to @uci.edu)</li>
      </ul>
    </div>

    {/* Backend */}
    <div className="bg-white dark:bg-dark-profile-card p-6 rounded-2xl shadow-md hover:shadow-xl transition duration-300">
      <div className="flex items-center mb-4">
        <FaPython className="text-3xl text-blue-600 dark:text-blue-400 mr-3" />
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Backend</h3>
      </div>
      <ul className="text-gray-700 dark:text-gray-300 space-y-2 text-lg pl-2">
        <li>• FastAPI (Python) for all API routes</li>
        <li>• Containerized with Docker</li>
        <li>• Handles data, auth, search, and scraping</li>
        <li>• PostgreSQL with full-text + vector search</li>
      </ul>
    </div>

    {/* Search System */}
    <div className="bg-white dark:bg-dark-profile-card p-6 rounded-2xl shadow-md hover:shadow-xl transition duration-300">
      <div className="flex items-center mb-4">
        <FaSearch className="text-3xl text-green-600 dark:text-green-400 mr-3" />
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Search System</h3>
      </div>
      <ul className="text-gray-700 dark:text-gray-300 space-y-2 text-lg pl-2">
        <li>• Hybrid search with FTS + vector embeddings</li>
        <li>• Scores combined using rank + cosine similarity</li>
        <li>• Helps students find clubs by interest or vibe</li>
      </ul>
    </div>

    {/* Scraper System */}
    <div className="bg-white dark:bg-dark-profile-card p-6 rounded-2xl shadow-md hover:shadow-xl transition duration-300">
      <div className="flex items-center mb-4">
        <FaInstagram className="text-3xl text-pink-600 dark:text-pink-400 mr-3" />
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Scraper System</h3>
      </div>
      <ul className="text-gray-700 dark:text-gray-300 space-y-2 text-lg pl-2">
        <li>• Instagram scraped via Selenium</li>
        <li>• Proxy rotation, cookies, and rate-limit detection</li>
        <li>• Redis-based job queue for scraping tasks</li>
        <li>• Parses event data from captions automatically</li>
      </ul>
    </div>

  </div>
</div>


        {/* Technical Details Section - Tech Stack */}
        <div className="mb-32 px-4 sm:px-6 lg:px-8 text-center">
  <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-900 dark:text-white tracking-tight">
    Our Tech Stack
  </h2>
  <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-16 max-w-3xl mx-auto leading-relaxed">
    Instinct is built with a modern, scalable tech stack designed for reliability and performance.
    Here's what powers our platform:
  </p>

  {/* Tech Categories */}
  <div className="space-y-24">
    {technologies.map((techCategory, index) => (
      <div key={index}>
        <h3 className="text-2xl md:text-3xl font-bold mb-10 text-gray-900 dark:text-white">
          {techCategory.category}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10 max-w-6xl mx-auto">
          {techCategory.tools.map((tool, toolIndex) => (
            <div
              key={toolIndex}
              className="relative group  p-6  transition duration-300 flex flex-col items-center justify-center text-center"
            >
              <div className="text-5xl mb-4 text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                {tool.icon}
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {tool.name}
              </span>

              {/* Tooltip */}
              <div className="absolute left-1/2 top-[105%] z-20 w-64 -translate-x-1/2 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-4 py-3 shadow-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 pointer-events-none">
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
        <div className="mb-24">
          <h2 className="text-3xl md:text-4xl font-bold mb-10 text-gray-900 dark:text-dark-text text-center">Cloud Infrastructure</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 max-w-5xl mx-auto">
            <div className="text-center flex flex-col items-center justify-center py-6">
              <div className="text-6xl text-blue-600 dark:text-blue-400 mb-5 hover:text-blue-500 dark:hover:text-blue-300 transition-colors duration-300">
                <VscAzure />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-dark-text">Azure Hosting</h3>
              <p className="text-gray-700 dark:text-dark-subtext max-w-xs mx-auto">
                Deployed on Azure Container Apps with Azure Container Registry
              </p>
            </div>
            
            <div className="text-center flex flex-col items-center justify-center py-6">
              <div className="text-6xl text-green-600 dark:text-green-400 mb-5 hover:text-green-500 dark:hover:text-green-300 transition-colors duration-300">
                <SiDocker />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-dark-text">Containerization</h3>
              <p className="text-gray-700 dark:text-dark-subtext max-w-xs mx-auto">
                Services containerized with Docker for consistent environments
              </p>
            </div>
            
            <div className="text-center flex flex-col items-center justify-center py-6">
              <div className="text-6xl text-purple-600 dark:text-purple-400 mb-5 hover:text-purple-500 dark:hover:text-purple-300 transition-colors duration-300">
                <SiGithubactions />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-dark-text">CI/CD Pipeline</h3>
              <p className="text-gray-700 dark:text-dark-subtext max-w-xs mx-auto">
                GitHub Actions for automated testing, building, and deployment
              </p>
            </div>
          </div>
        </div>
        
        
        
        {/* Advanced Features */}
        <div className="mb-32 px-4 sm:px-6 lg:px-8">
  <div className="max-w-5xl mx-auto text-center">

    <h2 className="text-4xl md:text-5xl font-extrabold mb-10 text-gray-900 dark:text-white tracking-tight">
      System Architecture
    </h2>

    {/* Diagram */}
    <div className="w-full flex justify-center rounded-2xl mb-10 shadow-inner p-4 overflow-x-auto">
  <img src="/diagram.svg" alt="System Architecture Diagram" className="w-full max-w-5xl h-auto" />
</div>


    {/* Description */}
    <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-10 leading-relaxed text-left">
      Instinct employs a microservices architecture with containerized services for scalability and redundancy.
      Our components interact through well-defined APIs and messaging systems, with Redis streams handling
      asynchronous tasks and notifications.
    </p>

    {/* Key Components */}
    <div className="mb-16 text-left">
      <h3 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Key Components:</h3>
      <ul className="space-y-3 text-gray-700 dark:text-gray-300 text-lg pl-4 list-disc">
        <li><strong>Client Layer:</strong> Next.js frontend deployed on Vercel</li>
        <li><strong>API Layer:</strong> FastAPI services containerized with Docker</li>
        <li><strong>Data Layer:</strong> PostgreSQL database with specialized search capabilities</li>
        <li><strong>Task Layer:</strong> Redis-backed job queues for scraping and notifications</li>
        <li><strong>Storage Layer:</strong> Azure Blob Storage for media files</li>
        <li><strong>Notification Layer:</strong> Discord bot for system alerts and moderation</li>
      </ul>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center mb-12">
      <div className="bg-white dark:bg-dark-profile-card p-6 rounded-xl shadow-md">
        <div className="text-3xl font-bold text-green-600 dark:text-green-400">99.9%</div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Uptime</div>
      </div>
      <div className="bg-white dark:bg-dark-profile-card p-6 rounded-xl shadow-md">
        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">&lt; 100ms</div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">API Response</div>
      </div>
      <div className="bg-white dark:bg-dark-profile-card p-6 rounded-xl shadow-md">
        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">Multiple</div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Deployment Regions</div>
      </div>
    </div>

    {/* GitHub Link */}
   
    
  </div>
</div>
        

      {/* In Progress/Future Section */}
<div className="mb-32 px-4 sm:px-6 lg:px-8">
  <div className="max-w-4xl mx-auto text-center">
    <h2 className="text-4xl md:text-5xl font-extrabold mb-10 text-gray-900 dark:text-white tracking-tight">
      In Progress & Coming Soon
    </h2>

    <div className="space-y-6 text-left text-gray-700 dark:text-gray-300 text-lg">
      {[
        "Migrating from Supabase S3 to Azure Blob Storage for improved integration with our infrastructure",
        "Adding smart job queue prioritization to focus on active clubs or those with missing data",
        "Improving semantic search capabilities for more intuitive club discovery",
        "Enhancing scraper speed and reliability through parallel processing",
        "Additional frontend polish and UI/UX improvements for a more engaging student experience"
      ].map((item, idx) => (
        <div key={idx} className="flex items-start">
          <span className="inline-block mr-4 mt-1 text-yellow-600 dark:text-yellow-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <span className="flex-1">{item}</span>
        </div>
      ))}
    </div>
  </div>
</div>
  
        
      </main>

      <Footer />
    </div>
  );
};

export default TechnicalAbout;