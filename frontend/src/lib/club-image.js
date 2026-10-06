// Public R2 CDN for club profile pictures. Matches next.config.mjs remotePatterns
// and the URLs the Heroku API already returns for profile_image_path.
const R2_PUBLIC_BASE =
  "https://pub-8e4c91981ff346a0af2d1a101b9dcc39.r2.dev";

/** Turn a DB-relative path or absolute URL into an absolute club image URL. */
export function resolveClubImageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const encoded = path
    .replace(/^\//, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${R2_PUBLIC_BASE}/${encoded}`;
}
