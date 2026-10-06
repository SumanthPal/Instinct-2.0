/**
 * OAuth return URL for Supabase's `redirectTo`. Resolved with URL() so a
 * site URL with a trailing slash (or a path) can't produce
 * "https://host//auth/callback"; Supabase compares this string against its
 * allowed redirect URLs.
 */
export function authCallbackUrl(siteUrl, fallbackOrigin) {
  const base = siteUrl?.trim() || fallbackOrigin;
  try {
    return new URL("/auth/callback", base).toString();
  } catch {
    // A malformed NEXT_PUBLIC_SITE_URL falls back to the current origin.
    return new URL("/auth/callback", fallbackOrigin).toString();
  }
}
