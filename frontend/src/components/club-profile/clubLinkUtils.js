import { safeHttpUrl } from "./clubDetailUtils";

// Query params Instagram and the usual share buttons add for tracking. Dropped
// so the links we show (and open) are the ones the club pasted.
const TRACKING = /^(utm_.+|fbclid|igsh|igshid|si|_t|_r)$/i;

function unwrap(href) {
  // Scraped bio links come wrapped in Instagram's redirector:
  // https://l.instagram.com/?u=<encoded target>&e=...
  try {
    const u = new URL(href);
    if (/(^|\.)l\.instagram\.com$/i.test(u.hostname) && u.searchParams.get("u")) {
      return u.searchParams.get("u");
    }
  } catch (_) {
    /* fall through */
  }
  return href;
}

function clean(raw) {
  const safe = safeHttpUrl(unwrap(String(raw || "")));
  if (!safe) return null;
  const u = new URL(safe);
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  return u;
}

const bareHost = (u) => u.hostname.replace(/^www\./i, "").toLowerCase();

/** "linktr.ee/foo" style text for a URL: host + path, no scheme or slash. */
export function displayUrl(u) {
  const path = `${u.pathname}${u.search}`.replace(/\/$/, "");
  return `${bareHost(u)}${path === "/" ? "" : path}`;
}

/** Comparison key so the same link pasted twice (or in the bio) is shown once. */
export function linkKey(u) {
  return `${bareHost(u)}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
}

const looksLikeUrl = (s) => !/\s/.test(s) && /\.[a-z]{2,}/i.test(s);

/**
 * clubs.club_links (jsonb[]) -> [{ href, title, display, host, key }].
 * Each scraped entry is { url, text }; text is the bio-links popup's label,
 * either "linktr.ee/foo" or "Title\nlinktr.ee/foo". Entries can also be bare
 * URL strings (the Club model types the column as List[str]).
 */
export function normalizeClubLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (let item of raw) {
    if (typeof item === "string") {
      try {
        item = JSON.parse(item);
      } catch (_) {
        item = { url: item };
      }
      if (typeof item === "string") item = { url: item };
    }
    const u = clean(item?.url);
    if (!u) continue;
    const key = linkKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    const lines = String(item?.text || "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && s !== "Link");
    let title = null;
    if (lines.length >= 2) title = lines.slice(0, -1).join(" ");
    else if (lines.length === 1 && !looksLikeUrl(lines[0])) title = lines[0];
    out.push({ href: u.href, title, display: displayUrl(u), host: bareHost(u), key });
  }
  return out;
}

// URLs typed into a bio: with a scheme, www., or a bare domain followed by a path.
const BIO_URL =
  /\b(?:https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|(?:[a-z0-9-]+\.)+(?:com|org|net|edu|gg|ly|ee|io|co|me|moe|app|dev|bio)\/[^\s<>"]*)/gi;

/**
 * Split bio text into strings and { href, text, key } link parts so inline
 * URLs can be clickable. Trailing punctuation stays text.
 */
export function linkifyBio(text) {
  const s = String(text || "");
  const parts = [];
  let last = 0;
  for (const m of s.matchAll(BIO_URL)) {
    const textPart = m[0].replace(/[.,!?;:)\]]+$/, "");
    const u = clean(textPart);
    if (!u) continue;
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push({ href: u.href, text: textPart, key: linkKey(u) });
    last = m.index + textPart.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
