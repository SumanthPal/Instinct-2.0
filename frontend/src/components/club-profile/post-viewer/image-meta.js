"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Tiny shared cache of post images: load status and natural aspect ratio.
 * The viewer sizes its frame from the ratio, and neighbours are preloaded
 * through the same cache, so moving between posts has no layout jump.
 */
const meta = new Map(); // url -> { status: "loading" | "loaded" | "error", ratio }
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function preloadImage(url) {
  if (!url || meta.has(url) || typeof window === "undefined") return;
  meta.set(url, { status: "loading", ratio: null });
  const img = new window.Image();
  img.decoding = "async";
  img.onload = () => {
    const ratio = img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
    meta.set(url, { status: "loaded", ratio });
    emit();
  };
  img.onerror = () => {
    meta.set(url, { status: "error", ratio: null });
    emit();
  };
  img.src = url;
}

const MISSING = { status: "missing", ratio: null };
const PENDING = { status: "loading", ratio: null };

export function useImageMeta(url) {
  const value = useSyncExternalStore(
    subscribe,
    () => (url ? meta.get(url) : MISSING),
    () => undefined,
  );
  useEffect(() => {
    preloadImage(url);
  }, [url]);
  if (!url) return MISSING;
  return value || PENDING;
}

// Instagram crops to 4:5 .. 1.91:1; the frame stays in that band and the
// image letterboxes inside it.
export const DEFAULT_RATIO = 4 / 5;
export function frameRatio(ratio) {
  if (!ratio || !Number.isFinite(ratio)) return DEFAULT_RATIO;
  return Math.min(1.91, Math.max(0.56, ratio));
}
