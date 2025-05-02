// pages/rss-viewer-ssr.js

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import Head from 'next/head';
import Parser from 'rss-parser';

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

export async function getServerSideProps(context) {
  try {
    // Default feed to fetch initially
    const defaultFeedType = 'categories';
    const defaultFeedName = 'All Headlines';
    const defaultFeedUrl = RSS_FEEDS[defaultFeedType][defaultFeedName];
    
    // Parse the RSS feed server-side
    const parser = new Parser();
    const feed = await parser.parseURL(defaultFeedUrl);
    
    return {
      props: {
        initialFeedData: feed,
        initialFeedType: defaultFeedType,
        initialFeedName: defaultFeedName,
      },
    };
  } catch (error) {
    console.error('Error fetching initial RSS feed:', error);
    return {
      props: {
        initialFeedData: null,
        initialFeedType: 'categories',
        initialFeedName: 'All Headlines',
        error: 'Failed to load initial RSS feed'
      },
    };
  }
}

const RSSViewerSSR = ({ initialFeedData, initialFeedType, initialFeedName, error: initialError }) => {
  const [activeTab, setActiveTab] = useState(initialFeedType);
  const [selectedFeed, setSelectedFeed] = useState({
    type: initialFeedType,
    name: initialFeedName
  });
  const [feedData, setFeedData] = useState(initialFeedData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || null);

  // Fetch the RSS feed when the selected feed changes (but not on initial load)
  useEffect(() => {
    // Skip the initial fetch since we already have the data from SSR
    if (selectedFeed.type === initialFeedType && selectedFeed.name === initialFeedName && initialFeedData) {
      return;
    }
    
    const fetchRssFeed = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const feedUrl = RSS_FEEDS[selectedFeed.type][selectedFeed.name];
        const encodedUrl = encodeURIComponent(feedUrl);
        const response = await fetch(`/api/getRssFeed?url=${encodedUrl}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch RSS feed');
        }
        
        const data = await response.json();
        setFeedData(data.feed);
      } catch (err) {
        console.error('Error fetching RSS feed:', err);
        setError('Failed to load RSS feed. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRssFeed();
  }, [selectedFeed, initialFeedType, initialFeedName, initialFeedData]);

  // Handle feed selection
  const handleFeedSelect = (type, name) => {
    setSelectedFeed({ type, name });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Head>
        <title>UCI News RSS Viewer | Instinct</title>
        <meta name="description" content="View the latest news from UCI across various categories and schools" />
      </Head>
      
      <Navbar />
      
      <main className="container mx-auto px-4 py-24">
        <h1 className="text-5xl font-bold mb-8 text-center text-gray-900 dark:text-dark-text">UCI News RSS Viewer</h1>
        
        {/* Tabs for Categories and Schools */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-3 text-xl font-semibold rounded-lg transition-colors ${
              activeTab === 'categories'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-dark-base dark:text-dark-subtext dark:hover:bg-dark-accent'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('schools')}
            className={`px-6 py-3 text-xl font-semibold rounded-lg ml-4 transition-colors ${
              activeTab === 'schools'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-dark-base dark:text-dark-subtext dark:hover:bg-dark-accent'
            }`}
          >
            Schools
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar with feed options */}
          <div className="w-full md:w-1/4 bg-white dark:bg-dark-base p-4 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-dark-text">
              {activeTab === 'categories' ? 'Categories' : 'Schools'}
            </h2>
            <ul className="space-y-2">
              {Object.keys(RSS_FEEDS[activeTab]).map((name) => (
                <li key={name}>
                  <button
                    onClick={() => handleFeedSelect(activeTab, name)}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      selectedFeed.type === activeTab && selectedFeed.name === name
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 font-semibold'
                        : 'hover:bg-gray-100 dark:hover:bg-dark-accent text-gray-700 dark:text-dark-subtext'
                    }`}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Main content area */}
          <div className="w-full md:w-3/4 bg-white dark:bg-dark-base p-6 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-dark-text">
              {selectedFeed.name}
            </h2>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
              </div>
            ) : error ? (
              <div className="text-red-600 dark:text-red-400 text-center py-8">
                <p className="text-xl">{error}</p>
              </div>
            ) : feedData && feedData.items ? (
              <div className="space-y-8">
                {feedData.items.map((item, index) => (
                  <div 
                    key={index} 
                    className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0"
                  >
                    <h3 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-dark-text">
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        {item.title}
                      </a>
                    </h3>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {new Date(item.pubDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    
                    <div 
                      className="text-gray-700 dark:text-dark-subtext prose prose-lg max-w-none"
                      dangerouslySetInnerHTML={{ __html: item.content || item.contentSnippet }}
                    />
                    
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block mt-4 text-purple-600 dark:text-purple-400 font-semibold hover:underline"
                    >
                      Read more →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-700 dark:text-dark-subtext">
                <p className="text-xl">No feed items found</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default RSSViewerSSR;