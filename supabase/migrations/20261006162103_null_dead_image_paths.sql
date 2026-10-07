-- One-time data fix. Not a schema change; do not copy this pattern for
-- routine cleanup. Safe to re-run: a second run matches no rows.
--
-- Post and profile images scraped before the move to Cloudflare R2 lived in
-- a GCS bucket that has since been deleted. Their rows still point at keys
-- that R2 never received, so the site renders broken images. This nulls
-- those paths; the API (#121) already turns a null path into no image and
-- the frontend shows its fallback. Rows are kept: captions and events still
-- use the posts, and a club re-scraped later gets a fresh R2 upload and its
-- path back from upsert_club.
--
-- Verified 2026-10-06 against https://pub-8e4c91981ff346a0af2d1a101b9dcc39.r2.dev
-- with a HEAD request per row, at the URL the API builds (cdn_url):
--
--   posts.image_path like 'posts/%': 18,160 checked, 17,926 404, 234 200.
--     Every 404 has created_at <= 2026-04-20 and every 200 >= 2026-09-02.
--     On prod the predicate below matched exactly those 17,926 ids (same
--     count and the same id set as the 404 list).
--
--   clubs.profile_image_path (all 451 are 'pfps/<handle>.jpg'): 416 404,
--     35 200. Every 404 has updated_at <= 2026-04-20 and every 200 >=
--     2026-09-02. One 404 club (csauci) was re-scraped by the daily job
--     minutes later and its image is now live; the predicate below no longer
--     matches it, so on prod it matched the remaining 415 404 ids exactly.
--     A club re-scraped before this runs drops out the same way.

UPDATE public.posts
SET image_path = NULL
WHERE image_path LIKE 'posts/%'
  AND created_at < '2026-09-01';

UPDATE public.clubs
SET profile_image_path = NULL
WHERE profile_image_path LIKE 'pfps/%'
  AND updated_at < '2026-09-01';
