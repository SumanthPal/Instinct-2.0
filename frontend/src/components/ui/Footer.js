import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full backdrop-blur-md bg-white/50 dark:bg-dark-profile-card/60 border-t border-gray-200 dark:border-gray-700 mt-auto rounded-3xl">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center space-y-4 text-center">
        
        {/* Social Links */}
        

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
