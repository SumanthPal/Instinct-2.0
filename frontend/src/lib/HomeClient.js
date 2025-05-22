"use client";
import { useRef, useState, useEffect } from "react";
import { createClient } from '@/lib/supabase';
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";
import SearchSection from "@/components/SearchSection";
import ViewControls from "@/components/ViewControls";
import ClubGrid from "@/components/ClubGrid";
import { useClubsData } from "@/lib/useClubData";
import "../../styles/globals.css";

export default function HomeClient({ initialClubs, totalCount, hasMore, currentPage }) {
  const supabase = createClient();
  const clubsRef = useRef(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Use custom hook for clubs data management
  const {
    filteredClubs,
    searchInput,
    selectedCategories,
    loading,
    hasMoreClubs,
    totalClubCount,
    setSearchInput,
    handleCategoryChange, // Use the handler from the hook
    handleLoadMore
  } = useClubsData(initialClubs, totalCount, hasMore, currentPage, user);

  // Check authentication status
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user || null);
        }
      );
      
      return () => subscription?.unsubscribe();
    };
    
    checkUser();
  }, []);

  // Infinite scroll setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreClubs && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 1.0 }
    );
    
    const loadMoreTrigger = document.getElementById('load-more-trigger');
    if (loadMoreTrigger) {
      observer.observe(loadMoreTrigger);
    }
    
    return () => {
      if (loadMoreTrigger) {
        observer.unobserve(loadMoreTrigger);
      }
    };
  }, [hasMoreClubs, loading, handleLoadMore]);

  const scrollToClubs = () => {
    clubsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
  };

  const handleSearch = () => {
    if (searchInput.trim() !== "") {
      scrollToClubs();
    }
  };

  const handleClearFilters = () => {
    setSearchInput("");
    handleCategoryChange([]); // Use the category handler
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      
      <main className="container mx-auto px-3 sm:px-4 pt-[100px] sm:pt-[120px] pb-10 sm:pb-16 md:pb-20 text-center">
        {/* Heading */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 text-dark-base dark:text-white">
            ANTEATER CLUBS
          </h1>
          <p className="text-dark-base dark:text-dark-subtext text-base sm:text-lg">Find and connect with campus organizations</p>
        </div>

        <SearchSection 
          searchInput={searchInput}
          onSearchChange={handleSearchChange}
          onSearch={handleSearch}
          user={user}
        />

        <ViewControls
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedCategories={selectedCategories}
          onCategoryChange={handleCategoryChange} // Pass the handler
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          showCategoryDropdown={showCategoryDropdown}
          setShowCategoryDropdown={setShowCategoryDropdown}
        />

        <div ref={clubsRef}>
          <ClubGrid
            clubs={filteredClubs}
            selectedCategories={selectedCategories}
            totalClubCount={totalClubCount}
            viewMode={viewMode}
            hasMoreClubs={hasMoreClubs}
            loading={loading}
            onClearFilters={handleClearFilters}
          />
        </div>
      </main>
      
      <Footer />

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        @media (max-width: 640px) {
          .fade-in {
            animation-duration: 0.3s;
          }
        }
      `}</style>
    </div>
  );
}

// Debug version - Add this temporarily to see what's happening
// Add this console.log in your CategoryPills component to debug:
