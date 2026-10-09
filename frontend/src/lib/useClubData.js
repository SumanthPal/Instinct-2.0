"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchClubManifest,
  fetchSmartSearch,
  fetchMoreClubs,
  fetchClubsByCategory,
  SEARCH_DEBOUNCE_MS
} from '@/lib/api';

const PAGE_SIZE = 20;

// One place that knows which endpoint serves a given query/category/page.
async function fetchClubsPage({ query, category, page }) {
  if (query) {
    return fetchSmartSearch(query, page, PAGE_SIZE, category);
  }
  if (category) {
    return page === 1
      ? fetchClubsByCategory(category, 1, PAGE_SIZE)
      : fetchMoreClubs(page, PAGE_SIZE, category);
  }
  return page === 1
    ? fetchClubManifest(1, PAGE_SIZE)
    : fetchMoreClubs(page, PAGE_SIZE, null);
}

/**
 * Club list state for /clubs.
 *
 * `initialSearch` seeds the query (from /clubs?search=...) so the very first
 * fetch already uses it. Every fetch takes a request id; a response whose id
 * is no longer current is dropped, so a slow earlier request can't overwrite
 * newer results and "load more" can't append to a list that has since changed.
 */
export function useClubsData(initialClubs, totalCount, hasMore, currentPage, initialSearch = "") {
  const seededQuery = initialSearch.trim();
  const [clubs, setClubs] = useState(initialClubs || []);
  const [filteredClubs, setFilteredClubs] = useState(initialClubs || []);
  const [searchInput, setSearchInput] = useState(seededQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(seededQuery);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [page, setPage] = useState(currentPage || 1);
  const [loading, setLoading] = useState(false);
  const [hasMoreClubs, setHasMoreClubs] = useState(hasMore || false);
  const [totalClubCount, setTotalClubCount] = useState(totalCount || 0);

  const requestId = useRef(0);
  // The caller already fetched page 1 of the unfiltered list; don't refetch it
  // on mount unless we were seeded with a search.
  const skipInitialFetch = useRef(Boolean(initialClubs?.length) && !seededQuery);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const category = selectedCategories.length === 1 ? selectedCategories[0] : null;

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    const id = ++requestId.current;
    const isSearch = debouncedSearch !== "";
    setLoading(true);

    (async () => {
      try {
        const data = await fetchClubsPage({
          query: debouncedSearch,
          category,
          page: 1,
        });
        if (id !== requestId.current) return;
        if (!isSearch) setClubs(data.results);
        setFilteredClubs(data.results);
        setPage(data.page || 1);
        setTotalClubCount(data.totalCount);
        setHasMoreClubs(data.hasMore);
      } catch (error) {
        if (id !== requestId.current) return;
        console.error("Error loading clubs:", error);
        if (!isSearch && category) filterLocalResults([category]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    })();
    // filterLocalResults reads the latest `clubs` and is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category]);

  const handleCategoryChange = useCallback((categories) => {
    setSelectedCategories(categories);
  }, []);

  // Local filtering fallback when the category endpoint fails
  const filterLocalResults = (categories) => {
    const filtered = clubs.filter(club => {
      if (!club.categories || club.categories.length === 0) return false;
      return club.categories.some(cat => {
        const categoryName = typeof cat === 'string' ? cat : cat.name;
        return categories.includes(categoryName);
      });
    });
    setFilteredClubs(filtered);
    setTotalClubCount(filtered.length);
    setHasMoreClubs(false); // No more to load when filtering locally
  };

  const handleLoadMore = async () => {
    if (loading || !hasMoreClubs) return;

    // Tie this page to the request that produced the current list.
    const id = requestId.current;
    const isSearch = debouncedSearch !== "";
    const nextPage = page + 1;
    setLoading(true);
    try {
      const data = await fetchClubsPage({
        query: debouncedSearch,
        category,
        page: nextPage,
      });
      if (id !== requestId.current) return;
      if (!isSearch) setClubs(prev => [...prev, ...data.results]);
      setFilteredClubs(prev => [...prev, ...data.results]);
      setHasMoreClubs(data.hasMore);
      setPage(nextPage);
    } catch (error) {
      console.error("Error loading more clubs:", error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  return {
    clubs,
    filteredClubs,
    searchInput,
    selectedCategories,
    page,
    query: debouncedSearch,
    loading,
    hasMoreClubs,
    totalClubCount,
    setSearchInput,
    handleCategoryChange,
    handleLoadMore
  };
}
