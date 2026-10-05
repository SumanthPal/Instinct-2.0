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

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
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

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-24">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
            <h2 className="mb-4 text-center text-2xl font-semibold text-destructive">
              Error Loading Clubs
            </h2>
            <p className="mb-6 text-center text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="instinct-btn w-full rounded-full py-3 font-medium text-white"
            >
              Retry
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-24">
          <div className="rounded-xl border border-border bg-card px-8 py-10 text-center shadow-sm">
            <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-foreground" />
            <h2 className="text-xl font-medium text-foreground">
              Loading Anteater Clubs...
            </h2>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <HomeClient
      initialClubs={initialData.clubs}
      totalCount={initialData.totalCount}
      hasMore={initialData.hasMore}
      currentPage={initialData.currentPage}
    />
  );
}
