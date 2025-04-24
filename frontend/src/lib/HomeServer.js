"use client";
import { useState, useEffect } from "react";
import HomeClient from "./HomeClient";
import { fetchClubManifest } from "../lib/api";

export default function HomeServer() {
  const [initialData, setInitialData] = useState({
    clubs: [],
    totalCount: 0,
    hasMore: false,
    currentPage: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial load of clubs
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Start with page 1 and 20 clubs per page
        const data = await fetchClubManifest(1, 20);
        
        setInitialData({
          clubs: data.results || [],
          totalCount: data.totalCount || 0,
          hasMore: data.hasMore || false,
          currentPage: data.page || 1,
        });
      } catch (err) {
        console.error("Failed to fetch club manifest:", err);
        setError("Failed to load clubs. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error Loading Clubs</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl text-gray-700 dark:text-gray-300">Loading clubs...</p>
      </div>
    );
  }

  // Show main content
  return (
    <HomeClient 
      initialClubs={initialData.clubs} 
      totalCount={initialData.totalCount}
      hasMore={initialData.hasMore}
      currentPage={initialData.currentPage}
    />
  );
}