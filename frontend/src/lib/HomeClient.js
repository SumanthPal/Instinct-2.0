"use client";
import { useRef, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";
import SearchSection from "@/components/SearchSection";
import ViewControls from "@/components/ViewControls";
import ClubGrid from "@/components/ClubGrid";
import { useClubsData } from "@/lib/useClubData";
import { fetchCategories } from "@/lib/api";
import { categoriesList } from "@/components/CategoryData";
import "../../styles/globals.css";

export default function HomeClient({
  initialClubs,
  totalCount,
  hasMore,
  currentPage,
}) {
  const clubsRef = useRef(null);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [allCategories, setAllCategories] = useState(categoriesList);

  const {
    clubs,
    filteredClubs,
    searchInput,
    selectedCategories,
    loading,
    hasMoreClubs,
    totalClubCount,
    setSearchInput,
    handleCategoryChange,
    handleLoadMore,
  } = useClubsData(initialClubs, totalCount, hasMore, currentPage, user);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const names = await fetchCategories();
      if (!cancelled && names.length) {
        setAllCategories(names);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
      });

      return () => subscription?.unsubscribe();
    };

    checkUser();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreClubs && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 1.0 },
    );

    const loadMoreTrigger = document.getElementById("load-more-trigger");
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
    handleCategoryChange([]);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      {/* Hidden SVG defs for gradient favorite star */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="instinct-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--instinct-pink)" />
            <stop offset="50%" stopColor="var(--instinct-purple)" />
            <stop offset="100%" stopColor="var(--instinct-sky)" />
          </linearGradient>
        </defs>
      </svg>

      <Navbar />

      <main className="container mx-auto flex-1 px-3 pb-10 pt-[100px] text-center sm:px-4 sm:pb-16 sm:pt-[120px] md:pb-20">
        <div className="mb-8 sm:mb-12">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-foreground sm:mb-3 sm:text-4xl md:text-5xl">
            Clubs & Organizations
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Find and connect with campus organizations
          </p>
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
          onCategoryChange={handleCategoryChange}
          allCategories={allCategories}
          clubs={clubs.length ? clubs : filteredClubs}
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
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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
