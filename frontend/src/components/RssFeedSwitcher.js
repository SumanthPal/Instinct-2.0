// components/RssFeedSwitcher.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import RssFeed from './RssFeed';

// RSS feed URLs for different categories and schools
const RSS_FEEDS = {
  categories: {
    'All Headlines': 'https://news.uci.edu/feed/',
    'Arts & Humanities': 'https://news.uci.edu/category/arts-humanities/feed/',
    'Athletics': 'https://news.uci.edu/category/athletics/feed/',
    'Campus Life': 'https://news.uci.edu/category/campus-life/feed/',
    'Health': 'https://news.uci.edu/category/health/feed/',
    'Science & Technology': 'https://news.uci.edu/category/science-technology/feed/',
    'Society & Community': 'https://news.uci.edu/category/society-community/feed/'
  },
  schools: {
    'Arts': 'https://news.uci.edu/category/schools/arts/feed/',
    'Biological Sciences': 'https://news.uci.edu/category/schools/biological-sciences/feed/',
    'Business': 'https://news.uci.edu/category/schools/business/feed/',
    'Education': 'https://news.uci.edu/category/schools/education/feed/',
    'Engineering': 'https://news.uci.edu/category/schools/engineering/feed/',
    'Health Sciences': 'https://news.uci.edu/category/schools/health-sciences/feed/',
    'Humanities': 'https://news.uci.edu/category/schools/humanities/feed/',
    'Information & Computer Sciences': 'https://news.uci.edu/category/schools/information-computer-sciences/feed/',
    'Law': 'https://news.uci.edu/category/schools/law/feed/',
    'Medicine': 'https://news.uci.edu/category/schools/medicine/feed/',
    'Physical Sciences': 'https://news.uci.edu/category/schools/physical-sciences/feed/',
    'Social Ecology': 'https://news.uci.edu/category/schools/social-ecology/feed/',
    'Social Sciences': 'https://news.uci.edu/category/schools/social-sciences/feed/'
  }
};

const RssFeedSwitcher = ({ 
  className,
  maxItems = 10,
  showFullContent = true,
  initialTab = 'categories',
  initialCategory = 'All Headlines'
}) => {
  const router = useRouter();
  const { tab, category } = router.query;
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  
  // Sync URL parameters with state
  useEffect(() => {
    if (tab && Object.keys(RSS_FEEDS).includes(tab)) {
      setActiveTab(tab);
    }
    
    if (category && RSS_FEEDS[activeTab] && Object.keys(RSS_FEEDS[activeTab]).includes(category)) {
      setSelectedCategory(category);
    }
  }, [tab, category, activeTab]);
  
  // Handle tab change
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    // Reset to first category in the tab
    const firstCategory = Object.keys(RSS_FEEDS[newTab])[0];
    setSelectedCategory(firstCategory);
    
    // Update URL
    router.push({
      pathname: router.pathname,
      query: { tab: newTab, category: firstCategory }
    }, undefined, { shallow: true });
  };
  
  // Handle category change
  const handleCategoryChange = (newCategory) => {
    setSelectedCategory(newCategory);
    
    // Update URL
    router.push({
      pathname: router.pathname,
      query: { tab: activeTab, category: newCategory }
    }, undefined, { shallow: true });
  };
  
  // Get the current feed URL
  const currentFeedUrl = RSS_FEEDS[activeTab]?.[selectedCategory] || RSS_FEEDS.categories['All Headlines'];

  return (
    <div className={className}>
      {/* Tab Switcher */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => handleTabChange('categories')}
          className={`px-6 py-3 text-xl font-semibold rounded-lg transition-colors ${
            activeTab === 'categories'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-dark-base dark:text-dark-subtext dark:hover:bg-dark-accent'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => handleTabChange('schools')}
          className={`px-6 py-3 text-xl font-semibold rounded-lg ml-4 transition-colors ${
            activeTab === 'schools'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-dark-base dark:text-dark-subtext dark:hover:bg-dark-accent'
          }`}
        >
          Schools
        </button>
      </div>
      
      {/* Category/School Selection */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {activeTab && RSS_FEEDS[activeTab] && Object.keys(RSS_FEEDS[activeTab]).map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === selectedCategory
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark-base dark:text-dark-subtext dark:hover:bg-dark-accent'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      
      {/* Feed Title */}
      <h2 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-dark-text">
        {selectedCategory}
      </h2>
      
      {/* RSS Feed Component */}
      <RssFeed
        feedUrl={currentFeedUrl}
        maxItems={maxItems}
        showFullContent={showFullContent}
      />
    </div>
  );
};

export default RssFeedSwitcher;