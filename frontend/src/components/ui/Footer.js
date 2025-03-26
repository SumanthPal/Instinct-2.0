import React, { useState } from 'react';
import { Github, Linkedin, MessageSquare, X } from 'lucide-react';

const Footer = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const mailtoLink = `mailto:sumanthpal@duck.com?subject=Feedback&body=${encodeURIComponent(message)}`;
    window.location.href = mailtoLink;
    setEmail('');
    setMessage('');
    setIsModalOpen(false);
  };

  return (
    <>
                          <footer className="w-full shadow-lg mt-auto bg-transparent">
                  <div className="w-full px-4 py-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-2">
                      {/* Social Links - Left */}
                      <div className="flex items-center space-x-4">
                        <a
                          href="https://github.com/SumanthPal"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                        >
                          <Github className="w-12 h-12" />
                        </a>
                        <a
                          href="https://www.linkedin.com/in/sumanth-pallamreddy-88271b239"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                        >
                          <Linkedin className="w-12 h-12" />
                        </a>
                      </div>
                
                      {/* Feedback Button - Center */}
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg transform transition-all duration-300 ease-in-out hover:scale-105 dark:hover:border-white dark:hover:text-white dark:text-gray-400"
                      >
                        <MessageSquare className="w-8 h-8" />
                        <p className='text-3xl'>Send Feedback</p>
                      </button>
                
                      {/* Copyright Text - Right */}
                      <div className="text-3xl text-gray-600 dark:text-gray-400">
                        © {new Date().getFullYear()} Instinct
                      </div>
                    </div>
                  </div>
                </footer>        

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-3xl font-semibold text-gray-900 dark:text-dark-text">Send Feedback</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xl font-medium text-gray-700 dark:text-dark-text mb-1">
                    Your Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-dark-profile-card dark:bg-dark-gradient-start dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-xl font-medium text-gray-700 dark:text-dark-text mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Your feedback..."
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dark-profile-card min-h-[100px] dark:bg-dark-gradient-start dark:border-gray-600 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full dark:bg-dark-profile-card bg-slate-400 text-white py-2 px-4 rounded-md hover:bg-slate-700 transition-colors"
                >
                  Send Feedback
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;