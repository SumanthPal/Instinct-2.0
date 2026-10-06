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

  const dateLabel = (d, long = false) =>
    new Date(d).toLocaleDateString('en-US', long
      ? { month: 'long', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric' });

  return (
    <div className={`${className}`}>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground motion-reduce:animate-none" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card py-4 text-center text-destructive">
          <p>{error}</p>
        </div>
      ) : feedData && feedData.items ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feedData.items.slice(0, maxItems).map((item, index) => {
              const imageUrl = item.enclosure?.url ||
                              (item.content && extractImageFromContent(item.content)) ||
                              null;
              const categories = item.categories?.map(cat => typeof cat === 'string' ? cat : cat.name) || [];
              const emoji = getCategoryEmoji(categories);

              return (
                <a
                  key={index}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="instinct-card group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {imageUrl && (
                    <div className="h-36 overflow-hidden bg-muted">
                      {/* biome-ignore lint/performance/noImgElement: arbitrary remote feed images */}
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border px-2 py-0.5">
                        {dateLabel(item.pubDate)}
                      </span>
                      <span aria-hidden="true">{emoji}</span>
                    </div>
                    <h3 className="mb-2 line-clamp-2 text-base font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {truncateText(stripHtml(item.content || item.contentSnippet || item.description || ''), 120)}
                    </p>
                    <span className="mt-auto text-sm font-medium text-foreground group-hover:underline">
                      Read more <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {feedData.items.slice(0, maxItems).map((item, index) => {
              const categories = item.categories?.map(cat => typeof cat === 'string' ? cat : cat.name) || [];
              const emoji = getCategoryEmoji(categories);

              return (
                <div
                  key={index}
                  className="rounded-xl border border-border bg-card p-6 text-left"
                >
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {dateLabel(item.pubDate, true)}
                    </span>
                    <span aria-hidden="true">{emoji}</span>
                    <span className="ml-auto">{item.creator || item.author || ''}</span>
                  </div>

                  <h3 className="mb-3 text-xl font-semibold tracking-tight text-foreground">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {item.title}
                    </a>
                  </h3>

                  <div className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    {showFullContent
                      ? <div dangerouslySetInnerHTML={{ __html: item.content || item.contentSnippet || item.description || '' }} />
                      : truncateText(stripHtml(item.content || item.contentSnippet || item.description || ''), 250)
                    }
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      Read full article <span className="ml-1" aria-hidden="true">↗</span>
                    </a>
                    <div className="ml-auto flex flex-wrap gap-2">
                      {categories.slice(0, 2).map((category, catIndex) => (
                        <span
                          key={catIndex}
                          className="instinct-tag rounded-full border px-2 py-0.5 text-xs"
                        >
                          {category}
                        </span>
                      ))}
                      {categories.length > 2 && (
                        <span className="instinct-tag rounded-full border px-2 py-0.5 text-xs">
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
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="font-medium text-muted-foreground">No feed items found</p>
        </div>
      )}
    </div>
  );
};

export default RssFeed;