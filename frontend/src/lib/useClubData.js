"use client";
import { useState, useEffect, useRef } from 'react';
import { 
  fetchClubManifest, 
  fetchSmartSearch, 
  fetchHybridSearch,
  fetchMoreClubs, 
  fetchClubsByCategory 
} from '@/lib/api';

export function useClubsData(initialClubs, totalCount, hasMore, currentPage, user) {
  const [clubs, setClubs] = useState(initialClubs || []);
  const [filteredClubs, setFilteredClubs] = useState(initialClubs || []);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [page, setPage] = useState(currentPage || 1);
  const [loading, setLoading] = useState(false);
  const [hasMoreClubs, setHasMoreClubs] = useState(hasMore || false);
  const [totalClubCount, setTotalClubCount] = useState(totalCount || 0);
  const [semanticWeight, setSemanticWeight] = useState(0.5);
  
  // Add a ref to track if we're currently processing a category change
  const categoryChangeInProgress = useRef(false);

  // Search effect - but ONLY run when it's not a category change
  useEffect(() => {
    // Skip search effect if category change is in progress
    if (categoryChangeInProgress.current) {
      return;
    }

    const searchClubs = async () => {
      // If no search input and no categories selected, show all clubs
      if (searchInput.trim() === "" && selectedCategories.length === 0) {
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

      // If no search input but categories are selected, don't interfere
      if (searchInput.trim() === "" && selectedCategories.length > 0) {
        return; // Let category filtering handle this
      }

      // Only run search if there's actual search input
      if (searchInput.trim() !== "") {
        setLoading(true);
        try {
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
              const data = await fetchSmartSearch(searchInput, 1, 20);
              setFilteredClubs(data.results);
              setTotalClubCount(data.totalCount);
              setHasMoreClubs(data.hasMore);
              setPage(data.page);
            }
          } else {
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
      }
    };

    const timeout = setTimeout(searchClubs, 500);
    return () => clearTimeout(timeout);
  }, [searchInput, user, semanticWeight]); // Remove selectedCategories from dependency array

  // Separate effect for category-only changes (when there's no search input)
  useEffect(() => {
    const handleCategoryOnlyFilter = async () => {
      // Only run this effect when there's no search input
      if (searchInput.trim() !== "") {
        return;
      }

      categoryChangeInProgress.current = true;
      setLoading(true);

      try {
        if (selectedCategories.length === 0) {
          // No categories selected - show all clubs
          const data = await fetchClubManifest(1, 20);
          setClubs(data.results);
          setFilteredClubs(data.results);
          setPage(1);
          setTotalClubCount(data.totalCount);
          setHasMoreClubs(data.hasMore);
        } else {
          // Categories selected - filter by category
          try {
            const data = await fetchClubsByCategory(selectedCategories[0], 1, 20);
            setClubs(data.results);
            setFilteredClubs(data.results);
            setPage(1);
            setTotalClubCount(data.totalCount);
            setHasMoreClubs(data.hasMore);
          } catch (error) {
            console.error("Error fetching by category, using local filter:", error);
            // Fallback to local filtering
            filterLocalResults(selectedCategories);
          }
        }
      } catch (error) {
        console.error("Error in category filter:", error);
      } finally {
        setLoading(false);
        // Reset the flag after a short delay to allow the search effect to run normally
        setTimeout(() => {
          categoryChangeInProgress.current = false;
        }, 100);
      }
    };

    handleCategoryOnlyFilter();
  }, [selectedCategories]); // Only depend on selectedCategories

  // Category filtering function - now just updates state
  const handleCategoryChange = async (categories) => {
    console.log('handleCategoryChange called with:', categories);
    setSelectedCategories(categories);
    // The actual filtering will be handled by the useEffect above
  };

  // Local filtering fallback
  const filterLocalResults = (categories) => {
    console.log('Local filtering with categories:', categories);
    const filtered = clubs.filter(club => {
      if (!club.categories || club.categories.length === 0) return false;
      return club.categories.some(cat => {
        const categoryName = typeof cat === 'string' ? cat : cat.name;
        return categories.includes(categoryName);
      });
    });
    console.log('Filtered results:', filtered.length, 'out of', clubs.length);
    setFilteredClubs(filtered);
    setTotalClubCount(filtered.length);
    setHasMoreClubs(false); // No more to load when filtering locally
  };

  const handleLoadMore = async () => {
    if (loading || !hasMoreClubs) return;
    
    setLoading(true);
    try {
      const nextPage = page + 1;
      let data;
      
      if (searchInput.trim() !== "") {
        if (user) {
          try {
            const category = selectedCategories.length === 1 ? selectedCategories[0] : null;
            data = await fetchHybridSearch(searchInput, nextPage, 20, category, semanticWeight);
          } catch (error) {
            console.error("Hybrid search load more failed:", error);
            data = await fetchSmartSearch(searchInput, nextPage, 20);
          }
        } else {
          data = await fetchSmartSearch(searchInput, nextPage, 20);
        }
      } else {
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

  return {
    clubs,
    filteredClubs,
    searchInput,
    selectedCategories,
    page,
    loading,
    hasMoreClubs,
    totalClubCount,
    setSearchInput,
    handleCategoryChange,
    handleLoadMore
  };
}