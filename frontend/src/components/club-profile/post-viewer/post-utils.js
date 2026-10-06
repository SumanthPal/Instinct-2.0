import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
} from "date-fns";
import { normalizeEvent } from "@/components/events-calendar/calendar-utils";
import { parseLocalDate, safeHttpUrl } from "../clubDetailUtils";

/**
 * The scraper saves the IG header with the caption ("insadance\n 10h\n…",
 * "blockchainuci\n Edited\n•\n1w\n…"). Drop that header so the caption reads
 * like Instagram's. Anything else is left as is.
 */
export function cleanCaption(caption, handle) {
  if (!caption) return "";
  let text = String(caption);
  const h = String(handle || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (h) {
    const header = new RegExp(
      `^\\s*${h}\\s*\\n(?:\\s*(?:Edited|•)\\s*\\n)*\\s*\\d+[smhdwy]\\s*\\n`,
      "i",
    );
    text = text.replace(header, "");
  }
  return text.trim();
}

// URLs (with or without scheme) and @mentions. Emails are skipped by the
// lookbehind on "@".
const TOKEN =
  /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|edu|io|ly|ee|co|gg|me|app|dev|link|page)\/[^\s]*|(?<![\w@])@[A-Za-z0-9._]{2,30})/gi;
const TRAILING = /[.,!?;:)\]}'"’”]+$/;

/** Caption -> [{ type: "text" | "link" | "mention", text, href }]. */
export function tokenizeCaption(text) {
  if (!text) return [];
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    let raw = m[0];
    const trail = raw.match(TRAILING)?.[0] || "";
    if (trail) raw = raw.slice(0, -trail.length);
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (raw.startsWith("@")) {
      const name = raw.slice(1).replace(/\.+$/, "");
      out.push({ type: "mention", text: `@${name}`, href: `https://www.instagram.com/${name}/` });
      const rest = raw.slice(1 + name.length) + trail;
      if (rest) out.push({ type: "text", text: rest });
    } else {
      const href = safeHttpUrl(raw);
      out.push(href ? { type: "link", text: raw, href } : { type: "text", text: raw });
      if (trail) out.push({ type: "text", text: trail });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Instagram-style age: "now", "12m", "5h", "4d", "3w", "2y". */
export function relativeAge(date, now = new Date()) {
  if (!date) return "";
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(now, date);
  if (days < 7) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 365)}y`;
}

export function postDate(post) {
  return parseLocalDate(post?.posted || post?.created_at || post?.date);
}

export function fullDate(date) {
  return date ? format(date, "MMMM d, yyyy") : "";
}

/**
 * Events rows (GET /club/:handle/events) carry post_id; group them by post.
 * Location is not a column yet, so read "Location: X." from the details.
 */
export function eventsByPost(events) {
  const map = new Map();
  for (const raw of events || []) {
    if (!raw?.post_id) continue;
    const ev = normalizeEvent(raw);
    if (!ev) continue;
    if (!ev.location) {
      const m = String(ev.details || "").match(/Location:\s*([^.\n]+)/i);
      if (m) ev.location = m[1].trim();
    }
    const key = String(raw.post_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  for (const list of map.values()) list.sort((a, b) => a.startMs - b.startMs);
  return map;
}
