"use client";
import React, { useState, useEffect } from 'react';
import { checkApiHealth } from '@/lib/api';

const Footer = () => {
  const [healthStatus, setHealthStatus] = useState('loading');
 
  useEffect(() => {
    // Initial health check
    const runHealthCheck = async () => {
      const status = await checkApiHealth();
      setHealthStatus(status);
    };
    
    runHealthCheck();
    
    // Set up a periodic health check every 30 seconds
    const intervalId = setInterval(runHealthCheck, 30000);
    
    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
    
    // Empty dependency array ensures this effect runs only once when component mounts
  }, []);

  const getStatusColor = () => {
    switch (healthStatus) {
      case 'Online':
        return 'bg-green-500';
      case 'Offline':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500'; // Loading state
    }
  };

  return (
    <footer className="w-full backdrop-blur-md bg-white/50 dark:bg-dark-profile-card/60 border-t border-gray-200 dark:border-gray-700 mt-auto rounded-t-3xl">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center space-y-4 text-center">
        
        {/* Health Status Indicator */}
        <div className="flex items-center space-x-2">
          <div className={`h-3 w-3 rounded-full ${getStatusColor()} animate-pulse`}></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {healthStatus === 'loading' ? 'Checking status...' : `Status: ${healthStatus}`}
          </span>
        </div>
        
        {/* Feedback Section */}
        <div className="my-2 flex justify-center">
  <a 
    href="https://airtable.com/app6eZfxp1tX3cTr1/pag44eL08NgLSEdu0/form"
    target="_blank" 
    rel="noopener noreferrer"
    className="flex items-center justify-center space-x-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white text-dark-base dark:bg-dark-card dark:text-white font-semibold transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg shadow-md text-sm sm:text-base relative overflow-hidden group border border-white/10"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 group-hover:rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>

    <span className="relative z-10">Share Feedback</span>

    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </a>
</div>
        {/* Legal Links */}
        <div className="flex space-x-4 text-sm">
          <a href="/documents/terms-and-conditions.pdf" target="_blank" rel="noopener noreferrer" className="text-gray-800 dark:text-gray-400 hover:underline">
            Terms & Conditions
          </a>
          <a href="/documents/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="text-gray-800 dark:text-gray-400 hover:underline">
            Privacy Policy
          </a>
        </div>
        
        {/* Disclaimer and Info */}
        <div className="text-gray-600 dark:text-gray-400 space-y-1 text-sm md:text-base">
          <p>Instinct is not affiliated with or endorsed by the University of California, Irvine.</p>
          <p>
            Questions?{' '}
            <a href="mailto:spallamr@uci.edu" className="underline hover:text-gray-900 dark:hover:text-white">
              spallamr@uci.edu
            </a>
          </p>
        </div>
        
        {/* Copyright */}
        <div className="text-xs text-gray-500 dark:text-gray-500">
          © {new Date().getFullYear()} Instinct
        </div>
      </div>
    </footer>
  );
};

export default Footer;