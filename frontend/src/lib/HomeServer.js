"use client";
import { useState, useEffect } from "react";
import HomeClient from "./HomeClient";
import { fetchClubManifest } from "../lib/api";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

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
      <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
        <Navbar />
        <main className="container mx-auto px-4 py-24 flex items-center justify-center">
          <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 p-8 rounded-xl shadow-lg max-w-md w-full border border-white/20 dark:border-dark-text/10">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4 text-center">Error Loading Clubs</h2>
            <p className="text-dark-base dark:text-dark-text mb-6 text-center">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-3 bg-lavender hover:bg-lavender/80 dark:bg-dark-gradient-start dark:hover:bg-dark-gradient-start/80 text-dark-base dark:text-dark-text-white rounded-full font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
        <Navbar />
        <main className="container mx-auto px-4 py-24 flex items-center justify-center">
          <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 p-8 rounded-xl shadow-lg text-center border border-white/20 dark:border-dark-text/10">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lavender dark:border-dark-gradient-start border-t-transparent dark:border-t-transparent mb-4"></div>
            <h2 className="text-xl font-medium text-dark-base dark:text-dark-text">Loading Anteater Clubs...</h2>
          </div>
        </main>
        <Footer />
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