import React from 'react';
import { Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full shadow-lg mt-auto backdrop-blur">
      <div className="w-full px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Social Links - Left */}
          <div className="flex items-center">
            <a
              href="https://www.linkedin.com/in/sumanth-pallamreddy-88271b239"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <Linkedin className="w-10 h-10" />
            </a>
          </div>
          
          {/* Disclaimers and Info - Center */}
          <div className="text-center text-gray-600 dark:text-gray-400 flex flex-col gap-2">
            <p>Instinct is not affiliated with or endorsed by the University of California, Irvine.</p>
            <p>For questions or support: <a href="mailto:spallamr@uci.edu" className="underline hover:text-gray-900 dark:hover:text-white">spallamr@uci.edu</a></p>
          </div>
          
          {/* Copyright Text - Right */}
          <div className="text-xl text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} Instinct
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;