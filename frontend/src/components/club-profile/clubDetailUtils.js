export function extractQuotedContent(str) {
  if (!str) return "";
  const matches = String(str).match(/"([^"]*)"/g);
  return matches ? matches.map((m) => m.slice(1, -1)).join(" ") : str;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateOnly(raw) {
  return typeof raw === "string" && DATE_ONLY.test(raw.trim());
}

/**
 * Parse an API date. Date-only strings ("2026-02-19") are read as local
 * midnight; `new Date("2026-02-19")` would be UTC midnight, which is the
 * previous evening in US timezones. Returns null for missing/invalid input.
 */
export function parseLocalDate(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  const m = s.match(DATE_ONLY);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local YYYY-MM-DD key for a Date (no UTC conversion). */
export function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Raw date value for an event (falls back to the post time) or a post. */
export function rawItemDate(item, type = "post") {
  if (!item) return null;
  if (type === "event") return item.date || item.parsed?.Date || item.posted || null;
  return item.posted || null;
}

/** Full timestamp for an item, or null. */
export function getItemDateTime(item, type = "post") {
  return parseLocalDate(rawItemDate(item, type));
}

/** Calendar day (local midnight) for an item, or null if missing/invalid. */
export function getPostDate(item, type = "post") {
  const d = getItemDateTime(item, type);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null;
}

export function getItemsForDate(items, date, type = "post") {
  const dateStr = formatDate(date);
  return (items || []).filter((item) => {
    const itemDate = getPostDate(item, type);
    return itemDate && formatDate(itemDate) === dateStr;
  });
}

/** Set of local YYYY-MM-DD keys that have at least one item. */
export function dateKeySet(items, type = "post") {
  const keys = new Set();
  for (const item of items || []) {
    const d = getPostDate(item, type);
    if (d) keys.add(formatDate(d));
  }
  return keys;
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const grouped = new Intl.NumberFormat("en-US");

/** 950 -> "950", 12345 -> "12.3K"; non-numbers -> "—". */
export function formatCount(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return "—";
  return n >= 10000 ? compact.format(n) : grouped.format(n);
}

/**
 * Only allow http(s) links from scraped bios. Scheme-less links
 * ("linktr.ee/foo") are treated as https. Returns null otherwise.
 */
export function safeHttpUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(s);
  try {
    const url = new URL(hasScheme ? s : `https://${s}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch (_) {
    return null;
  }
}

export function normalizeHandle(handle) {
  return String(handle || "").trim().replace(/^@/, "").toLowerCase();
}

export function clubAvatarUrl(clubData) {
  return (
    clubData?.profile_image_url ||
    clubData?.profile_image_path ||
    clubData?.profile_pic ||
    null
  );
}

export function categoryNames(categories) {
  if (!Array.isArray(categories)) return [];
  return categories
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter(Boolean);
}
