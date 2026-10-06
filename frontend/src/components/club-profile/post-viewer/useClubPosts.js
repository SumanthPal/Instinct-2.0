"use client";

import { useCallback, useRef, useState } from "react";
import { fetchClubPosts } from "@/lib/api";

function initialState(initial) {
  const posts = Array.isArray(initial?.results)
    ? initial.results
    : Array.isArray(initial)
      ? initial
      : [];
  return {
    posts,
    page: initial?.page || 1,
    hasMore: Boolean(initial?.hasMore),
    total: typeof initial?.total === "number" ? initial.total : null,
  };
}

/**
 * A club's posts, starting from the server-rendered first page and growing a
 * page at a time (same page size as the server fetch, so pages line up).
 * The grid and the viewer both read this list, so they stay in sync.
 */
export function useClubPosts(handle, initial) {
  const [state, setState] = useState(() => initialState(initial));
  const [loading, setLoading] = useState(false);
  const inflight = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadMore = useCallback(async () => {
    const { page, hasMore } = stateRef.current;
    if (inflight.current || !hasMore || !handle) return;
    inflight.current = true;
    setLoading(true);
    try {
      const next = page + 1;
      // fetchClubPosts returns an empty page with hasMore: false on errors,
      // which also stops further paging.
      const res = await fetchClubPosts(handle, next);
      setState((s) => {
        const seen = new Set(s.posts.map((p) => String(p.id)));
        const fresh = res.results.filter((p) => !seen.has(String(p.id)));
        return {
          posts: fresh.length ? [...s.posts, ...fresh] : s.posts,
          page: next,
          hasMore: Boolean(res.hasMore) && res.results.length > 0,
          total: res.total ?? s.total,
        };
      });
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [handle]);

  return { ...state, loading, loadMore };
}
