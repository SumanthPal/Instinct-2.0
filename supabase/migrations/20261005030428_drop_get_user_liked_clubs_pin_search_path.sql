-- #73 function cleanup.
--
-- 1. Drop get_user_liked_clubs. It is SECURITY DEFINER, anon and authenticated
--    can call it through /rest/v1/rpc, it reads a club_categories table that
--    does not exist (so it fails anyway), and nothing in the repo calls it.
--
-- 2. Pin search_path on the remaining public functions (Supabase advisor
--    "function_search_path_mutable"). public keeps every unqualified table,
--    pg_trgm and pgvector name resolving as before; pg_catalog is always
--    searched first implicitly; pg_temp goes last so temp objects can't shadow
--    anything. ALTER FUNCTION ... SET leaves the bodies, owners and grants as
--    they are. Extension functions are not touched.
--
-- This must run after 20261005030000_fix_clubs_by_category_followers_type.sql
-- (it does, by timestamp): that migration uses CREATE OR REPLACE, which resets
-- the function's search_path setting.

DROP FUNCTION IF EXISTS public.get_user_liked_clubs(uuid);

ALTER FUNCTION public.check_like_rate_limit() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_orphaned_records() SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_old_events() SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_rejected_pending_club() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_clubs_by_category_paginated(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_clubs_for_embedding() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_never_scraped_clubs(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_oldest_scraped_clubs(timestamp without time zone, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.hybrid_search(text, public.vector, double precision, double precision, double precision) SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_club_search_vector() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_clubs_paginated(text, integer, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_club_embedding_on_post_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_photo_reload_flags() SET search_path = public, pg_temp;
