// app/news/page.js
"use client";
import React, { useState } from 'react';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import RssFeed from '@/components/RssFeed';
import Link from 'next/link';

// Separate the metadata exports for Next.js App Router


// Separate viewport export to fix the warning

// RSS feed URLs for different categories and schools
const RSS_FEEDS = {
  categories: {
    'All Headlines': 'https://news.uci.edu/feed/',
    'Arts & Humanities': 'https://news.uci.edu/category/art-and-humanities/feed/',
    'Athletics': 'https://news.uci.edu/category/athletics/feed/',
    'Campus Life': 'https://news.uci.edu/category/campus-life/feed/',
    'Health': 'https://news.uci.edu/category/health/feed/',
    'Science & Technology': 'https://news.uci.edu/category/science-and-tech/feed/',
    'Society & Community': 'https://news.uci.edu/category/society-and-community/feed/'
  },
  schools: {
    'Arts': 'https://news.uci.edu/category/arts/feed/',
    'Biological Sciences': 'https://news.uci.edu/category/biological-sciences/feed/',
    'Business': 'https://news.uci.edu/category/business/feed/',
    'Education': 'https://news.uci.edu/category/education/feed/',
    'Engineering': 'https://news.uci.edu/category/engineering/feed/',
    'Health Sciences': 'https://news.uci.edu/category/health-sciences/feed/',
    'Humanities': 'https://news.uci.edu/category/humanities/feed/',
    'Information & Computer Sciences': 'https://news.uci.edu/category/ics/feed/',
    'Law': 'https://news.uci.edu/category/law/feed/',
    'Medicine': 'https://news.uci.edu/category/medicine/feed/',
    'Physical Sciences': 'https://news.uci.edu/category/physical-sciences/feed/',
    'Social Ecology': 'https://news.uci.edu/category/social-ecology/feed/',
    'Social Sciences': 'https://news.uci.edu/category/social-sciences/feed/'
  }
};

export default function NewsPage() {
  const [activeTab, setActiveTab] = useState('categories');
  const [selectedCategory, setSelectedCategory] = useState('All Headlines');
  
  // Function to handle changing the feed category/school
  const handleFeedChange = (category) => {
    setSelectedCategory(category);
  };
  
  // Get the current feed URL based on active tab and selected category
  const currentFeedUrl = RSS_FEEDS[activeTab][selectedCategory];

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      
      <Navbar />
      
      <main className="container mx-auto px-4 py-24">
        <h1 className="text-5xl font-bold mb-8 text-center text-gray-900 dark:text-dark-text">UCI News</h1>
        
        {/* Main tabs for Categories vs Schools */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-3 text-xl font-semibold rounded-lg transition-colors ${
              activeTab === 'categories'
                ? 'dark:bg-dark-card bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-dark-base dark:text-dark-subtext dark:hover:bg-dark-accent'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('schools')}
            className={`px-6 py-3 text-xl font-semibold rounded-lg ml-4 transition-colors ${
              activeTab === 'schools'
                ? 'dark:bg-dark-card bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-dark-base dark:text-dark-subtext dark:hover:bg-dark-accent'
            }`}
          >
            Schools
          </button>
        </div>
        
        {/* Category/School Selection Buttons */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {Object.keys(RSS_FEEDS[activeTab]).map((category) => (
            <button
              key={category}
              onClick={() => handleFeedChange(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === selectedCategory
                  ? 'dark:bg-dark-card bg-blue-400 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark-gradient-start dark:text-dark-subtext dark:hover:bg-dark-accent'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Current Feed Display */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-dark-text">{selectedCategory}</h2>
          <RssFeed
            feedUrl={currentFeedUrl}
            className="w-full"
            maxItems={10}
            showFullContent={true}
          />
        </div>
        
        {/* Featured Categories Section */}
        <div className="mt-24">
          <h2 className="text-4xl font-bold mb-8 text-center text-gray-900 dark:text-dark-text">Featured Categories</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Science & Technology Feed */}
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-dark-text">Science & Technology</h3>
              <RssFeed
                feedUrl={RSS_FEEDS.categories['Science & Technology']}
                maxItems={3}
                showFullContent={false}
              />
            </div>
            
            {/* Campus Life Feed */}
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-dark-text">Campus Life</h3>
              <RssFeed
                feedUrl={RSS_FEEDS.categories['Campus Life']}
                maxItems={3}
                showFullContent={false}
              />
            </div>
            
            {/* Arts & Humanities Feed */}
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-dark-text">Arts & Humanities</h3>
              <RssFeed
                feedUrl={RSS_FEEDS.categories['Arts & Humanities']}
                maxItems={3}
                showFullContent={false}
              />
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}