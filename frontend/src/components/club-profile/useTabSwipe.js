"use client";

import { useEffect, useRef } from "react";

const PHONE = "(max-width: 639px)";
const LOCK = 10; // px of travel before deciding horizontal vs vertical
const EDGE = 24; // px: leave screen edges to the browser's back/forward gesture
const COMMIT = 0.25; // fraction of width, or a fast flick
const FLICK = 0.45; // px/ms
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Inside something that scrolls sideways (chip rows, carousels) or opted out?
function blocked(target, root) {
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (el.closest?.("[data-no-swipe], input, textarea, select, [contenteditable=true]")) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

/**
 * Phone-only swipe between sibling tabs (no deps). The panel follows the
 * finger; onProgress(p) reports -1..1 so the tab indicator can track it.
 * index/count: current tab and how many; onChange(i) switches.
 */
export function useTabSwipe({ index, count, onChange, onProgress, enabled = true }) {
  const panel = useRef(null);
  const s = useRef(null);
  const dir = useRef(0);

  const move = (x, ms) => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.7,.3,1)` : "";
    el.style.transform = x ? `translate3d(${x}px,0,0)` : "";
  };

  // Tab changed after a swipe: slide the new panel in from that side.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the tab
  useEffect(() => {
    const d = dir.current;
    dir.current = 0;
    onProgress?.(0, 0);
    if (!d || reduced() || !panel.current) return move(0, 0);
    move(d * panel.current.offsetWidth * 0.3, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => move(0, 220)));
  }, [index]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: move only touches the ref; rebinding on every render would drop an in-flight touch
  useEffect(() => {
    const el = panel.current;
    if (!el || !enabled) return;
    const reset = () => {
      s.current = null;
      move(0, 180);
      onProgress?.(0, 180);
    };
    const start = (e) => {
      s.current = null;
      if (e.touches.length !== 1 || !window.matchMedia(PHONE).matches) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      if (blocked(e.target, el)) return;
      s.current = { x: t.clientX, y: t.clientY, t: e.timeStamp, axis: null, dx: 0 };
    };
    const moveH = (e) => {
      const st = s.current;
      if (!st) return;
      if (e.touches.length !== 1) return reset(); // pinch: let the browser zoom
      const t = e.touches[0];
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;
      if (!st.axis) {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
        st.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
        if (st.axis === "y") {
          s.current = null; // vertical: hands off for the rest of this touch
          return;
        }
      }
      e.preventDefault(); // we own this horizontal drag (no page wobble)
      st.dx = dx;
      const w = el.offsetWidth;
      const edge = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
      const x = edge ? dx / 4 : dx;
      if (reduced()) return;
      move(x, 0);
      onProgress?.(Math.max(-1, Math.min(1, -x / w)), 0);
    };
    const end = (e) => {
      const st = s.current;
      s.current = null;
      if (st?.axis !== "x") return;
      const w = el.offsetWidth;
      const v = Math.abs(st.dx) / Math.max(1, e.timeStamp - st.t);
      const next = index + (st.dx < 0 ? 1 : -1);
      const go = (Math.abs(st.dx) > w * COMMIT || (v > FLICK && Math.abs(st.dx) > 30)) && next >= 0 && next < count;
      if (!go) {
        move(0, 180);
        return onProgress?.(0, 180);
      }
      dir.current = st.dx < 0 ? 1 : -1;
      if (reduced()) return onChange(next);
      move(-dir.current * w, 150);
      onProgress?.(dir.current, 150);
      setTimeout(() => onChange(next), 150);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", moveH, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", reset);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", moveH);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", reset);
    };
  }, [index, count, onChange, onProgress, enabled]);

  return panel;
}
