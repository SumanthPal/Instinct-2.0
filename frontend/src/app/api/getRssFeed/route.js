// app/api/getRssFeed/route.js
import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { error: 'RSS feed URL is required' },
      { status: 400 }
    );
  }
  
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(url);
    
    return NextResponse.json({ feed });
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed' },
      { status: 500 }
    );
  }
}