"use client";

import { useRef, useState, useEffect } from "react";
import ClubCard from "../components/ClubCard";
import SearchBar from "../components/ui/SearchBar";
import CategoryFilter from "../components/ui/CategoryFilter";
import ParallaxBackground from "../components/ui/ParallaxBackground";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";
import { fetchMoreClubs, fetchClubsByCategory } from "../lib/api";

export default function HomeClient({ initialClubs, totalCount, hasMore, currentPage }) {
  const [clubs, setClubs] = useState(initialClubs || []);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const clubsRef = useRef(null);
  const [page, setPage] = useState(currentPage || 1);
  const [loading, setLoading] = useState(false);
  const [hasMoreClubs, setHasMoreClubs] = useState(hasMore || false);
  const [filteredClubs, setFilteredClubs] = useState(initialClubs || []);
  const [totalClubCount, setTotalClubCount] = useState(totalCount || 0);
  
  // Filter clubs whenever search input changes
  useEffect(() => {
    if (searchInput === "") {
      setFilteredClubs(clubs);
      return;
    }
    
    const filtered = clubs.filter((club) => {
      return club.name.toLowerCase().includes(searchInput.toLowerCase());
    });
    
    setFilteredClubs(filtered);
  }, [searchInput, clubs]);

  // Handle category changes
  useEffect(() => {
    const fetchClubsWithCategory = async () => {
      // If no categories selected, restore original list
      if (selectedCategories.length === 0) {
        setFilteredClubs(clubs);
        return;
      }
      
      setLoading(true);
      
      try {
        // In a real app, you'd make an API call with the category filter
        // For this example, we're filtering client-side
        const filtered = clubs.filter((club) => {
          return selectedCategories.some((category) => 
            club.categories.includes(category)
          );
        });
        
        setFilteredClubs(filtered);
      } catch (error) {
        console.error("Error fetching clubs by category:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClubsWithCategory();
  }, [selectedCategories, clubs]);

  const scrollToClubs = () => {
    clubsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
  };

  const handleCategoryChange = (categories) => {
    setSelectedCategories(categories);
  };

  const handleLoadMore = async () => {
    if (loading || !hasMoreClubs) return;
    
    setLoading(true);
    try {
      const nextPage = page + 1;
      
      // Use the category in the API call if one is selected
      const category = selectedCategories.length === 1 ? selectedCategories[0] : null;
      const data = await fetchMoreClubs(nextPage, 20, category);
      
      // Append new clubs to existing ones
      setClubs(prevClubs => [...prevClubs, ...data.results]);
      setFilteredClubs(prevFilteredClubs => {
        // Filter the new clubs with current search and category filters
        const newFilteredClubs = data.results.filter(club => {
          const matchesSearch = searchInput === "" || 
            club.name.toLowerCase().includes(searchInput.toLowerCase());
          
          const matchesCategory = selectedCategories.length === 0 ||
            selectedCategories.some(category => club.categories.includes(category));
            
          return matchesSearch && matchesCategory;
        });
        
        return [...prevFilteredClubs, ...newFilteredClubs];
      });
      
      setHasMoreClubs(data.hasMore);
      setPage(nextPage);
    } catch (error) {
      console.error("Error loading more clubs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Setup intersection observer for infinite scrolling
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
  }, [hasMoreClubs, loading]);

  // Get all unique categories from clubs
  const allCategories = [
    ...new Set(clubs.flatMap((club) => club.categories)),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <ParallaxBackground />
      </div>

      <Navbar />
      <main className="w-full px-4 py-8 flex flex-col items-center justify-center text-center">
        <div className="hero min-h-[50vh] flex flex-col items-center justify-center z-10 mb-8">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <h1
              className="font-bold text-gray-900 dark:text-white"
              style={{
                fontSize: "clamp(2.5rem, 8vw, 4rem)",
              }}
            >
              Explore UC Irvine
            </h1>
          </div>
          
          <h2 className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-8">
            Find and connect with campus organizations
          </h2>

          {/* Search Bar and Category Filter */}
          <div className="flex flex-col items-start w-full max-w-2xl mx-auto">
            <SearchBar
              value={searchInput}
              onChange={handleSearchChange}
              onEnter={scrollToClubs}
              placeholder="Search clubs by name, category, or keyword..."
            />
            <div className="relative mt-4 w-full">
              <CategoryFilter
                categories={allCategories}
                selectedCategories={selectedCategories}
                onChange={handleCategoryChange}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedCategories.map((category) => (
                  <div
                    key={category}
                    className="inline-flex items-center gap-2 px-3 py-1
                      bg-white/90 dark:bg-slate-700/90
                      text-sm text-gray-900 dark:text-white 
                      rounded-full border border-transparent
                      hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200"
                  >
                    <span>{category}</span>
                    <button
                      onClick={() =>
                        handleCategoryChange(
                          selectedCategories.filter(
                            (selected) => selected !== category
                          )
                        )
                      }
                      className="text-gray-500 hover:text-red-500 transition-colors duration-200 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div ref={clubsRef} className="w-full max-w-7xl text-left px-4 sm:px-6 mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Search Results ({filteredClubs.length} of {totalClubCount})
          </h2>
        </div>

        {/* Club Cards Grid */}
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 
                    w-full max-w-7xl px-4 sm:px-6 mb-12"
        >
          {filteredClubs.length > 0 ? (
            filteredClubs.map((club) => (
              <ClubCard
                key={club.id}
                club={{
                  profilePicture: club.profile_pic,
                  name: club.name,
                  description: club.description,
                  instagram: club.instagram_handle,
                  categories: club.categories,
                }}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-700 dark:text-gray-300 text-xl mb-2">
                No clubs match your search criteria
              </p>
              <button
                onClick={() => {
                  setSearchInput("");
                  setSelectedCategories([]);
                }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Load More Trigger for Intersection Observer */}
        {hasMoreClubs && (
          <div id="load-more-trigger" className="h-10 w-full flex items-center justify-center mb-8">
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-200"></div>
            ) : (
              <button
                onClick={handleLoadMore}
                className="px-6 py-2 text-base font-semibold bg-blue-600 text-white rounded-lg 
                         hover:bg-blue-700 transition-colors duration-200"
              >
                Load More
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}