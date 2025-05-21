"use client";
// components/RssFeed.js
import React, { useState, useEffect } from 'react';

const RssFeed = ({ 
  initialFeedData = null,
  feedUrl,
  className,
  maxItems = 5,
  showFullContent = false,
  viewMode = 'grid' // 'grid' or 'list'
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

  // Function to extract image from content if possible
  const extractImageFromContent = (content) => {
    if (!content) return null;
    
    // Look for image tags in the content
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
    const match = content.match(imgRegex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return null;
  };

  // Function to generate a category image based on category name
  const getCategoryImage = (categories) => {
    if (!categories || categories.length === 0) return null;
    
    // Map of categories to image backgrounds
    const categoryBgMap = {
      'Campus Life': 'from-lavender to-sky-blue',
      'Athletics': 'from-sky-blue to-pastel-pink',
      'Science & Technology': 'from-pastel-pink to-lavender',
      'Arts & Humanities': 'from-lavender to-pastel-pink',
      'Health': 'from-sky-blue to-lavender',
      'Society & Community': 'from-pastel-pink to-sky-blue',
      'Engineering': 'from-sky-blue to-pastel-pink',
      'Faculty': 'from-lavender to-sky-blue',
      'Students': 'from-pastel-pink to-lavender'
    };
    
    // Find the first category that has a defined background
    const matchedCategory = categories.find(cat => categoryBgMap[cat]);
    
    return matchedCategory 
      ? `bg-gradient-to-br ${categoryBgMap[matchedCategory] || 'from-lavender to-sky-blue'}`
      : 'bg-gradient-to-br from-lavender to-sky-blue'; // Default
  };

  // Function to get category emoji
  const getCategoryEmoji = (categories) => {
    if (!categories || categories.length === 0) return '📰';
    
    const categoryEmojiMap = {
      'Campus Life': '🏫',
      'Athletics': '🏀',
      'Science & Technology': '🔬',
      'Arts & Humanities': '🎨',
      'Health': '🩺',
      'Society & Community': '👥',
      'Engineering': '⚙️',
      'Faculty': '👩‍🏫',
      'Students': '👨‍🎓'
    };
    
    const matchedCategory = categories.find(cat => categoryEmojiMap[cat]);
    return matchedCategory ? categoryEmojiMap[matchedCategory] : '📰';
  };

  return (
    <div className={`${className}`}>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lavender dark:border-dark-text"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 dark:text-red-400 text-center py-4 rounded-xl bg-white/50 dark:bg-dark-card/50 backdrop-blur-md">
          <p>{error}</p>
        </div>
      ) : feedData && feedData.items ? (
        viewMode === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {feedData.items.slice(0, maxItems).map((item, index) => {
              const imageUrl = item.enclosure?.url || 
                              (item.content && extractImageFromContent(item.content)) || 
                              null;
              const categories = item.categories?.map(cat => typeof cat === 'string' ? cat : cat.name) || [];
              const categoryBg = getCategoryImage(categories);
              const emoji = getCategoryEmoji(categories);
              
              return (
                <div 
                  key={index} 
                  className={`group relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-102 h-64 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 border border-white/20 dark:border-dark-text/20 shadow-md`}
                >
                  {/* Category Background */}
                  <div className={`absolute inset-0 ${categoryBg} opacity-30`}></div>
                  
                  {/* Text Readability Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent z-10"></div>
                  
                  {/* Image if available */}
                  {imageUrl && (
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={imageUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover opacity-40"
                      />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="absolute inset-0 p-5 z-20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center mb-2">
                        <span className="bg-lavender/70 dark:bg-dark-gradient-start/70 text-dark-base dark:text-dark-text-white text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm">
                          {new Date(item.pubDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="ml-2 bg-white/30 dark:bg-dark-gradient-start/30 backdrop-blur-sm w-7 h-7 flex items-center justify-center rounded-full text-dark-base dark:text-dark-text-white">
                          {emoji}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-dark-base dark:text-dark-text-white mb-2 line-clamp-2">
                        {item.title}
                      </h3>
                      
                      <p className="text-dark-base/80 dark:text-dark-text/80 text-sm mb-3 line-clamp-3">
                        {truncateText(stripHtml(item.content || item.contentSnippet || item.description || ''), 120)}
                      </p>
                    </div>
                    
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-dark-base dark:text-dark-text-white font-medium hover:underline z-30 text-sm"
                    >
                      Read more
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                  
                  {/* Clickable overlay for entire card */}
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-0"
                    aria-label={item.title}
                  ></a>
                </div>
              );
            })}
          </div>
        ) : (
          // List View
          <div className="space-y-6">
            {feedData.items.slice(0, maxItems).map((item, index) => {
              const categories = item.categories?.map(cat => typeof cat === 'string' ? cat : cat.name) || [];
              const emoji = getCategoryEmoji(categories);
              
              return (
                <div 
                  key={index}
                  className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 border border-white/20 dark:border-dark-text/20 rounded-xl p-6 shadow-md hover:shadow-lg transition-all"
                >
                  <div className="flex items-center mb-3">
                    <span className="bg-lavender/70 dark:bg-dark-gradient-start/70 text-dark-base dark:text-dark-text-white text-xs font-medium px-2 py-1 rounded-full">
                      {new Date(item.pubDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="ml-2 bg-white/30 dark:bg-dark-gradient-start/30 w-7 h-7 flex items-center justify-center rounded-full text-dark-base dark:text-dark-text-white">
                      {emoji}
                    </span>
                    <div className="ml-auto text-xs text-dark-base/70 dark:text-dark-subtext">
                      {item.creator || item.author || ''}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-dark-base dark:text-dark-text-white mb-3">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-sky-blue dark:hover:text-lavender transition"
                    >
                      {item.title}
                    </a>
                  </h3>
                  
                  <div className="text-dark-base dark:text-dark-text text-sm leading-relaxed mb-4">
                    {showFullContent
                      ? <div dangerouslySetInnerHTML={{ __html: item.content || item.contentSnippet || item.description || '' }} />
                      : truncateText(stripHtml(item.content || item.contentSnippet || item.description || ''), 250)
                    }
                  </div>
                  
                  <div className="flex">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 rounded-full bg-lavender/50 dark:bg-dark-gradient-start/50 text-dark-base dark:text-dark-text-white text-sm font-medium hover:bg-lavender dark:hover:bg-dark-gradient-start transition-colors"
                    >
                      Read full article
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    
                    {/* Categories Pills */}
                    <div className="ml-auto flex flex-wrap gap-2">
                      {categories.slice(0, 2).map((category, catIndex) => (
                        <span 
                          key={catIndex}
                          className="text-xs px-2 py-1 rounded-full bg-white/30 dark:bg-dark-gradient-end/30 text-dark-base dark:text-dark-subtext"
                        >
                          {category}
                        </span>
                      ))}
                      {categories.length > 2 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-white/30 dark:bg-dark-gradient-end/30 text-dark-base dark:text-dark-subtext">
                          +{categories.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-white/20 dark:bg-dark-card/20 backdrop-blur-md rounded-xl border border-white/10 dark:border-dark-text/10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-lavender/60 dark:text-dark-subtext/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="mt-4 text-dark-base dark:text-dark-subtext font-medium">No feed items found</p>
        </div>
      )}
    </div>
  );
};

export default RssFeed;