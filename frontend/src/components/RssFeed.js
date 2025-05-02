"use client";
// components/RssFeed.js
import React, { useState, useEffect } from 'react';

const RssFeed = ({ 
  initialFeedData = null,
  feedUrl,
  className,
  maxItems = 5,
  showFullContent = false,
}) => {
  const [feedData, setFeedData] = useState(initialFeedData);
  const [loading, setLoading] = useState(!initialFeedData);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false); // Track if we've fetched already

  useEffect(() => {
    // Reset state when feed URL changes
    if (feedUrl) {
      setLoading(true);
      setError(null);
      setHasFetched(false);
    }
  }, [feedUrl]);

  useEffect(() => {
    if (!feedUrl || hasFetched) return;

    const fetchRssFeed = async () => {
      try {
        const encodedUrl = encodeURIComponent(feedUrl);
        const response = await fetch(`/api/getRssFeed?url=${encodedUrl}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch RSS feed');
        }
        
        const data = await response.json();
        setFeedData(data.feed);
      } catch (err) {
        console.error('Error fetching RSS feed:', err);
        setError('Failed to load RSS feed');
      } finally {
        setLoading(false);
        setHasFetched(true); // Mark as fetched so we don't try again
      }
    };

    fetchRssFeed();
  }, [feedUrl, hasFetched]);

  // Function to strip HTML tags safely (works in both browser and server environments)
  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
  };

  // Function to truncate text
  const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className={`bg-white dark:bg-dark-gradient-start rounded-lg shadow-lg p-6 ${className}`}>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 dark:text-red-400 text-center py-4">
          <p>{error}</p>
        </div>
      ) : feedData && feedData.items ? (
        <div className="space-y-6">
          {feedData.items.slice(0, maxItems).map((item, index) => (
            <div 
              key={index} 
              className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0"
            >
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-dark-text">
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  {item.title}
                </a>
              </h3>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {new Date(item.pubDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              
              {showFullContent ? (
                <div 
                  className="text-gray-700 dark:text-dark-subtext prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: item.content || item.contentSnippet }}
                />
              ) : (
                <p className="text-gray-700 dark:text-dark-subtext">
                  {truncateText(stripHtml(item.content || item.contentSnippet || ''))}
                </p>
              )}
              
              <a 
                href={item.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block mt-2 text-purple-600 dark:text-purple-400 font-semibold hover:underline text-sm"
              >
                Read more →
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-700 dark:text-dark-subtext">
          <p>No feed items found</p>
        </div>
      )}
    </div>
  );
};

export default RssFeed;