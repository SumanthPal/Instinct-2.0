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
      
      <main className="container mx-auto px-4 py-24 text-center">
  <h1 className="text-5xl font-bold mb-16 text-gray-900 dark:text-white">UCI News</h1>

  {/* Glass Tabs */}
  <div className="inline-flex mb-12 backdrop-blur-sm bg-white/30 dark:bg-white/10 p-1 rounded-full border border-white/20 shadow-md">
    {['categories', 'schools'].map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`px-6 py-2 rounded-full text-lg font-medium transition-all ${
          activeTab === tab
            ? 'bg-black/80 dark:bg-white/20 text-white'
            : 'text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10'
        }`}
      >
        {tab.charAt(0).toUpperCase() + tab.slice(1)}
      </button>
    ))}
  </div>

  {/* Subcategory Buttons */}
  <div className="flex flex-wrap justify-center gap-3 mb-20">
    {Object.keys(RSS_FEEDS[activeTab]).map((category) => (
      <button
        key={category}
        onClick={() => handleFeedChange(category)}
        className={`px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border transition-colors ${
          category === selectedCategory
            ? 'bg-black/80 text-white dark:bg-white/20 dark:text-white'
            : 'border-gray-300 dark:border-white/20 bg-white/30 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/20'
        }`}
      >
        {category}
      </button>
    ))}
  </div>

  {/* Main Feed */}
  <section className="mb-32">
    <h2 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">{selectedCategory}</h2>
    <RssFeed feedUrl={currentFeedUrl} className="mx-auto max-w-3xl" maxItems={10} showFullContent />
  </section>

  {/* Featured Categories */}
  <section className="mt-32">
    <h2 className="text-4xl font-bold mb-12 text-gray-900 dark:text-white">Featured Categories</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-6xl mx-auto">
      {[
        'Science & Technology',
        'Campus Life',
        'Arts & Humanities'
      ].map((cat) => (
        <div key={cat}>
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{cat}</h3>
          <RssFeed
            feedUrl={RSS_FEEDS.categories[cat]}
            maxItems={3}
            showFullContent={false}
            className="max-w-md mx-auto"
          />
        </div>
      ))}
    </div>
  </section>
</main>

      
      <Footer />
    </div>
  );
}