// pages/api/getRssFeed.js
// Server-side API route to fetch RSS feeds

import Parser from 'rss-parser';

export default async function handler(req, res) {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'RSS feed URL is required' });
  }
  
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(url);
    
    res.status(200).json({ feed });
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    res.status(500).json({ error: 'Failed to fetch RSS feed' });
  }
}