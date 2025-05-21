"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from '@/lib/supabase';
import ClubCard from "../components/ClubCard";
import SearchBar from "../components/ui/SearchBar";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";
import { useToast } from "@/components/ui/toast";
import { 
  fetchClubManifest, 
  fetchSmartSearch, 
  fetchHybridSearch,
  fetchMoreClubs, 
  fetchClubsByCategory 
} from '@/lib/api';
import "../../styles/globals.css";

export default function HomeClient({ initialClubs, totalCount, hasMore, currentPage }) {
  const supabase = createClient();
  const { toast } = useToast();
  const [clubs, setClubs] = useState(initialClubs || []);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const clubsRef = useRef(null);
  const [page, setPage] = useState(currentPage || 1);
  const [loading, setLoading] = useState(false);
  const [hasMoreClubs, setHasMoreClubs] = useState(hasMore || false);
  const [filteredClubs, setFilteredClubs] = useState(initialClubs || []);
  const [totalClubCount, setTotalClubCount] = useState(totalCount || 0);
  const [user, setUser] = useState(null);
  const [semanticWeight, setSemanticWeight] = useState(0.5);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  // New state for mobile optimization
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Check authentication status on component mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      // Set up auth state change listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user || null);
        }
      );
      
      return () => subscription?.unsubscribe();
    };
    
    checkUser();
  }, []);

  // Filter clubs whenever search input changes
  useEffect(() => {
    const searchClubs = async () => {
      if (searchInput.trim() === "") {
        // Full reset when search input cleared
        setLoading(true);
        try {
          const data = await fetchClubManifest(1, 20);
          setClubs(data.results);
          setFilteredClubs(data.results);
          setPage(1);
          setTotalClubCount(data.totalCount);
          setHasMoreClubs(data.hasMore);
        } catch (error) {
          console.error("Error resetting clubs:", error);
        } finally {
          setLoading(false);
        }
        return;
      }
  
      // Search handling based on authentication status
      setLoading(true);
      try {
        // Try hybrid search for authenticated users
        if (user) {
          try {
            const data = await fetchHybridSearch(
              searchInput, 
              1, 
              20, 
              selectedCategories.length === 1 ? selectedCategories[0] : null,
              semanticWeight
            );
            setFilteredClubs(data.results);
            setTotalClubCount(data.totalCount);
            setHasMoreClubs(data.hasMore);
            setPage(data.page);
          } catch (error) {
            console.error("Hybrid search failed, falling back to smart search:", error);
            // If hybrid search fails, fall back to smart search
            const data = await fetchSmartSearch(searchInput, 1, 20);
            setFilteredClubs(data.results);
            setTotalClubCount(data.totalCount);
            setHasMoreClubs(data.hasMore);
            setPage(data.page);
          }
        } else {
          // For non-authenticated users, use normal smart search
          const data = await fetchSmartSearch(searchInput, 1, 20);
          setFilteredClubs(data.results);
          setTotalClubCount(data.totalCount);
          setHasMoreClubs(data.hasMore);
          setPage(data.page);
        }
      } catch (error) {
        console.error("Error searching clubs:", error);
      } finally {
        setLoading(false);
      }
    };
  
    const timeout = setTimeout(searchClubs, 500); // debounce
    
    return () => clearTimeout(timeout);
  }, [searchInput, user]);
  
  const scrollToClubs = () => {
    clubsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
  };

  const handleSearch = async () => {
    if (searchInput.trim() !== "") {
      // Show toast for non-authenticated users
      if (!user) {
        // Use the direct toast API for immediate notifications
        toast({
          title: "Authentication Required",
          description: "Sign in to use hybrid search capabilities for better results",
          status: "info",
          duration: 5000,
          isClosable: true,
        });
      }
      
      scrollToClubs();
    }
  };

  const handleCategoryChange = async (categories) => {
    setSelectedCategories(categories);
    // Close the dropdown on mobile after selecting
    setShowCategoryDropdown(false);
  
    if (categories.length === 0) {
      if (searchInput.trim() === "") {
        const data = await fetchClubManifest(1, 20);
        setClubs(data.results);
        setFilteredClubs(data.results);
        setPage(1);
        setTotalClubCount(data.totalCount);
        setHasMoreClubs(data.hasMore);
      } else {
        // Use appropriate search based on auth status
        if (user) {
          try {
            const data = await fetchHybridSearch(searchInput, 1, 20, null, semanticWeight);
            setFilteredClubs(data.results);
            setTotalClubCount(data.totalCount);
            setHasMoreClubs(data.hasMore);
            setPage(data.page);
          } catch (error) {
            console.error("Hybrid search failed, falling back to smart search:", error);
            const data = await fetchSmartSearch(searchInput, 1, 20);
            setFilteredClubs(data.results);
            setTotalClubCount(data.totalCount);
            setHasMoreClubs(data.hasMore);
            setPage(data.page);
          }
        } else {
          const data = await fetchSmartSearch(searchInput, 1, 20);
          setFilteredClubs(data.results);
          setPage(1);
          setTotalClubCount(data.totalCount);
          setHasMoreClubs(data.hasMore);
        }
      }
      return;
    }
  
    // Categories selected
    if (searchInput.trim() === "") {
      // Browsing mode: Fetch clubs filtered by category
      const data = await fetchClubsByCategory(categories[0], 1, 20);
      setClubs(data.results);
      setFilteredClubs(data.results);
      setPage(1);
      setTotalClubCount(data.totalCount);
      setHasMoreClubs(data.hasMore);
    } else {
      // Search mode with categories
      if (user) {
        try {
          // For authenticated users, try hybrid search with category
          const data = await fetchHybridSearch(
            searchInput, 
            1, 
            20, 
            categories[0],
            semanticWeight
          );
          setFilteredClubs(data.results);
          setTotalClubCount(data.totalCount);
          setHasMoreClubs(data.hasMore);
          setPage(data.page);
        } catch (error) {
          console.error("Error with hybrid category search:", error);
          // Fall back to filtering existing results
          const filtered = filteredClubs.filter(club => 
            club.categories.some(cat => categories.includes(cat.name))
          );
          setFilteredClubs(filtered);
        }
      } else {
        // For non-authenticated, filter the existing search results locally
        const filtered = filteredClubs.filter(club => 
          club.categories.some(cat => categories.includes(cat.name))
        );
        setFilteredClubs(filtered);
      }
    }
  };
  
  const handleLoadMore = async () => {
    if (loading || !hasMoreClubs) return;
    
    setLoading(true);
    try {
      const nextPage = page + 1;
      let data;
      
      if (searchInput.trim() !== "") {
        // If searching, use appropriate search method based on auth
        if (user) {
          try {
            const category = selectedCategories.length === 1 ? selectedCategories[0] : null;
            data = await fetchHybridSearch(
              searchInput, 
              nextPage, 
              20, 
              category,
              semanticWeight
            );
          } catch (error) {
            console.error("Hybrid search load more failed:", error);
            // Fall back to smart search
            data = await fetchSmartSearch(searchInput, nextPage, 20);
          }
        } else {
          // For non-authenticated, use smart search
          data = await fetchSmartSearch(searchInput, nextPage, 20);
        }
      } else {
        // Normal load more
        const category = selectedCategories.length === 1 ? selectedCategories[0] : null;
        data = await fetchMoreClubs(nextPage, 20, category);
      }
      
      setClubs(prev => [...prev, ...data.results]);
      setFilteredClubs(prev => [...prev, ...data.results]);
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
  const categoriesList = [
    'Diversity and Inclusion',
    'Greek Life',
    'International',
    'Peer Support',
    'Fitness',
    'Hobbies and Interest',
    'Religious and Spiritual',
    'Cultural and Social',
    'Technology',
    'Graduate',
    'Performance and Entertainment',
    'Career and Professional',
    'LGBTQ',
    'Academics and Honors',
    'Media',
    'Political',
    'Education',
    'Environmental',
    'Community Service',
    'Networking'
  ];

  // Category emoji mapping
  const categoryEmojis = {
    'All': '📚',
    'Diversity and Inclusion': '🌈',
    'Greek Life': '🏛️',
    'International': '🌎',
    'Peer Support': '🤝',
    'Fitness': '🏋️',
    'Hobbies and Interest': '🎨',
    'Religious and Spiritual': '🕊️',
    'Cultural and Social': '🎭',
    'Technology': '💻',
    'Graduate': '🎓',
    'Performance and Entertainment': '🎬',
    'Career and Professional': '💼',
    'LGBTQ': '🏳️‍🌈',
    'Academics and Honors': '📖',
    'Media': '📱',
    'Political': '🗳️',
    'Education': '🏫',
    'Environmental': '🌱',
    'Community Service': '❤️',
    'Networking': '🔗',
  };
  
  // Group categories for tabs
  const categoryGroups = {
    'all': 'All Clubs',
    'academic': 'Academic',
    'cultural': 'Cultural',
    'career': 'Career',
    'interest': 'Interests'
  };
  
  // Map categories to groups
  const getCategoryGroup = (category) => {
    if (['Academics and Honors', 'Education', 'Graduate', 'Technology'].includes(category)) {
      return 'academic';
    } else if (['Cultural and Social', 'International', 'Diversity and Inclusion', 'LGBTQ', 'Religious and Spiritual'].includes(category)) {
      return 'cultural';
    } else if (['Career and Professional', 'Networking', 'Media'].includes(category)) {
      return 'career';
    } else {
      return 'interest';
    }
  };

  // Filter categories for the active tab
  const filteredCategories = activeTab === 'all' 
    ? categoriesList 
    : categoriesList.filter(category => getCategoryGroup(category) === activeTab);

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      
      <main className="container mx-auto px-3 sm:px-4 py-10 sm:py-16 md:py-20 text-center">
        {/* Heading */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 text-dark-base dark:text-white">
            ANTEATER CLUBS
          </h1>
          <p className="text-dark-base dark:text-dark-subtext text-base sm:text-lg">Find and connect with campus organizations</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 sm:mb-8 max-w-2xl mx-auto">
          <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10 p-1 shadow-md">
            <SearchBar
              value={searchInput}
              onChange={handleSearchChange}
              onEnter={handleSearch}
              placeholder="Search clubs..."
              className="w-full bg-transparent text-dark-base dark:text-dark-text py-2 sm:py-3 px-4 sm:px-5 rounded-full outline-none placeholder:text-dark-base/50 dark:placeholder:text-dark-text/50 text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Mobile: View mode + Category dropdown toggle in one row */}
        <div className="flex flex-wrap items-center justify-between md:justify-center mb-6 gap-2">
        {/* View Toggle */}
          <div className="inline-flex backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg p-1 border border-white/20 dark:border-dark-text/10">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white' : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'}`}
              aria-label="Grid view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white' : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'}`}
              aria-label="List view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          {/* Mobile: Category dropdown toggle */}
          <button 
            className="md:hidden inline-flex items-center gap-1 px-4 py-2 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg border border-white/20 dark:border-dark-text/10 text-dark-base dark:text-dark-text"
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <span>Categories</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Mobile: Dropdown for categories */}
        {showCategoryDropdown && (
          <div className="md:hidden mb-6 p-3 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg border border-white/20 dark:border-dark-text/10 shadow-md">
            <div className="flex flex-wrap justify-start gap-2 mb-3">
              {Object.entries(categoryGroups).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key);
                  }}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === key
                      ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                      : 'text-dark-base dark:text-dark-text bg-white/20 dark:bg-dark-card/20 hover:bg-white/30 dark:hover:bg-dark-text/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap justify-start gap-2">
              <button
                key="all-categories"
                onClick={() => handleCategoryChange([])}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedCategories.length === 0
                    ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                    : 'bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50'
                }`}
              >
                <span className="mr-1">{categoryEmojis['All'] || '📚'}</span> All
              </button>
              
              {filteredCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange([category])}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedCategories.includes(category)
                      ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                      : 'bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50'
                  }`}
                >
                  <span className="mr-1">{categoryEmojis[category] || '📄'}</span> {category.length > 12 ? category.slice(0, 10) + '...' : category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Desktop: Category Tabs - Hide on mobile */}
        <div className="hidden md:inline-flex mb-8 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 p-1 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md">
          {Object.entries(categoryGroups).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-base sm:text-lg font-medium transition-all ${
                activeTab === key
                  ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                  : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Desktop: Category Pills with Emojis - Hide on mobile */}
        <div className="hidden md:flex flex-wrap justify-center gap-2 mb-8 lg:mb-12 max-w-4xl mx-auto">
          <button
            key="all-categories"
            onClick={() => handleCategoryChange([])}
            className={`px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
              selectedCategories.length === 0
                ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                : 'bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50'
            }`}
          >
            <span className="mr-1">{categoryEmojis['All'] || '📚'}</span> All Categories
          </button>
          
          {filteredCategories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryChange([category])}
              className={`px-3 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                selectedCategories.includes(category)
                  ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                  : 'bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50'
              }`}
            >
              <span className="mr-1">{categoryEmojis[category] || '📄'}</span> {category}
            </button>
          ))}
        </div>

        {/* Main Feed - Club Results */}
        <section className="mb-12 sm:mb-20" ref={clubsRef}>
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-10 sm:w-16 mr-2 sm:mr-4"></div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-dark-base dark:text-white flex items-center flex-wrap justify-center">
              <span className="mr-2">
                {selectedCategories.length === 1 
                  ? categoryEmojis[selectedCategories[0]] || '📄' 
                  : '📚'}
              </span>
              <span className="truncate max-w-[150px] sm:max-w-none">
                {selectedCategories.length === 1 ? selectedCategories[0] : 'All Clubs'}
              </span>
              <span className="ml-2 sm:ml-3 text-sm sm:text-base md:text-lg font-normal">({filteredClubs.length} of {totalClubCount})</span>
            </h2>
            <div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-10 sm:w-16 ml-2 sm:ml-4"></div>
          </div>
          
          {/* Club Cards Grid */}
          <div className={`${
            viewMode === 'grid' 
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6' 
              : 'flex flex-col gap-3 sm:gap-4'
          } max-w-6xl mx-auto`}>
            {filteredClubs.length > 0 ? (
              filteredClubs.map((club) => (
                <div key={club.id} className={`${
                  viewMode === 'grid'
                    ? 'transform transition-transform hover:scale-[1.02] hover:shadow-lg'
                    : 'w-full'
                } backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 overflow-hidden shadow-md fade-in`}>
                  <ClubCard
                    club={{
                      profilePicture: club.profile_image_url ? club.profile_image_path : club.profile_pic,
                      name: club.name,
                      description: club.description,
                      instagram: club.instagram_handle,
                      categories: club.categories,
                    }}
                    viewMode={viewMode}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 sm:py-12 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10">
                <p className="text-dark-base dark:text-dark-text text-lg sm:text-xl mb-2">
                  No clubs match your search criteria
                </p>
                <button
                  onClick={() => {
                    setSearchInput("");
                    setSelectedCategories([]);
                  }}
                  className="px-4 sm:px-6 py-2 mt-3 sm:mt-4 bg-lavender hover:bg-lavender/80 dark:bg-dark-gradient-start dark:hover:bg-dark-gradient-start/80 text-dark-base dark:text-dark-text-white rounded-full font-medium transition-all text-sm sm:text-base"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
          
          {/* Load More Indicator */}
          {hasMoreClubs && (
            <div className="text-center mt-6 sm:mt-8">
              <div className="inline-block px-4 sm:px-6 py-2 sm:py-3 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md text-sm sm:text-base">
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin mr-2 h-3 w-3 sm:h-4 sm:w-4 border-2 border-lavender dark:border-dark-gradient-start border-t-transparent dark:border-t-transparent rounded-full"></div>
                    <span className="text-dark-base dark:text-dark-text">Loading more clubs...</span>
                  </div>
                ) : (
                  <span className="text-dark-base dark:text-dark-text">Scroll for more clubs</span>
                )}
              </div>
            </div>
          )}
          
          <div id="load-more-trigger" className="h-1 w-full"></div>
        </section>
      </main>
      
      <Footer />

      {/* Add custom CSS for animations */}
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
        `}
        </style>
        </div>
  );
}