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
           <div className={`backdrop-blur-sm bg-white/30 dark:bg-white/10 border border-white/20 rounded-2xl p-6 shadow-md ${className}`}>
           {loading ? (
             <div className="flex justify-center items-center h-24">
               <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
             </div>
           ) : error ? (
             <div className="text-red-600 dark:text-red-400 text-center">
               <p>{error}</p>
             </div>
           ) : feedData && feedData.items ? (
             <div className="space-y-8">
               {feedData.items.slice(0, maxItems).map((item, index) => (
                 <div key={index}>
                   <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                     <a
                       href={item.link}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
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
                   <p className="text-gray-800 dark:text-gray-300 text-sm leading-relaxed">
                     {showFullContent
                       ? <span dangerouslySetInnerHTML={{ __html: item.content || item.contentSnippet }} />
                       : truncateText(stripHtml(item.content || item.contentSnippet || ''))
                     }
                   </p>
                   <a
                     href={item.link}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-block mt-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-sm"
                   >
                     Read more →
                   </a>
                 </div>
               ))}
             </div>
           ) : (
             <p className="text-center text-gray-700 dark:text-gray-300">No articles found.</p>
           )}
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