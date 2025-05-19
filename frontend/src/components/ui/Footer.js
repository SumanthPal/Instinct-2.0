"use client";
import React, { useState, useEffect } from 'react';

const Footer = () => {
  const [healthStatus, setHealthStatus] = useState('loading');
  
  // Move the checkHealth function outside useEffect to avoid recreating it on every render
  const checkHealth = async () => {
    try {
      const response = await fetch('https://web2.gentlemeadow-727fb9e6.westus.azurecontainerapps.io/health');
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data.status === 'healthy' ? 'Online' : 'Offline');
      } else {
        setHealthStatus('Systems Offline');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus('Systems Offline');
    }
  };

  useEffect(() => {
    // Initial health check
    checkHealth();
    
    // Set up a periodic health check every 30 seconds
    const intervalId = setInterval(checkHealth, 30000);
    
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