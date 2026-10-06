"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function urlWith(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("post", id);
  else url.searchParams.delete("post");
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Open post kept in `?post=<id>`: opening pushes one history entry (so Back
 * closes the viewer), moving between posts replaces it, and a shared link
 * opens straight onto the post.
 */
export function usePostParam(posts) {
  const [openId, setOpenId] = useState(null);
  const openRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    openRef.current = openId;
  }, [openId]);

  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(window.location.search).get("post");
      const known = id && posts.some((p) => String(p.id) === id);
      setOpenId(known ? id : null);
      if (!id) pushed.current = false;
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [posts]);

  const open = useCallback((id) => {
    if (id == null) return;
    const key = String(id);
    if (openRef.current) {
      window.history.replaceState(null, "", urlWith(key));
    } else {
      window.history.pushState(null, "", urlWith(key));
      pushed.current = true;
    }
    openRef.current = key;
    setOpenId(key);
  }, []);

  const close = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = null;
    setOpenId(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", urlWith(null));
    }
  }, []);

  const index = openId == null ? null : posts.findIndex((p) => String(p.id) === openId);
  return { index: index === -1 ? null : index, open, close };
}
