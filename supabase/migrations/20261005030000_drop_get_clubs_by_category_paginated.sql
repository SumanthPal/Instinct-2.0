-- Drop get_clubs_by_category_paginated (#68).
--
-- It declares followers integer but clubs.followers is smallint, so every
-- call has errored and /club?category= has always used the Python filter in
-- SupabaseQueries.get_clubs_paginated. Repairing the type would have moved
-- that route onto the RPC, which returns no total (hasMore false, pages 0)
-- and only the filtered category for clubs in several categories. The
-- backend no longer calls it, and nothing else does.

DROP FUNCTION IF EXISTS public.get_clubs_by_category_paginated(text, integer, integer);
