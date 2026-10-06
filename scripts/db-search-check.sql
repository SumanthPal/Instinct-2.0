-- Club search checks against supabase/seed.sql, run by CI's db-migrations job:
--   psql -v ON_ERROR_STOP=1 -o /dev/null -f scripts/db-search-check.sql
-- Everything runs in one transaction that is rolled back, so the database is
-- left as it was. Any failed check raises and stops the run.
BEGIN;

CREATE FUNCTION pg_temp.handles(q text, cat text DEFAULT NULL) RETURNS text[]
LANGUAGE sql AS $$
  SELECT coalesce(array_agg(instagram_handle ORDER BY ord), '{}')
  FROM (SELECT instagram_handle, row_number() OVER () AS ord
        FROM public.search_clubs_paginated(q, 0, 50, cat)) s
$$;

CREATE FUNCTION pg_temp.expect(label text, got text[], want text[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'search check "%": got %, want %', label, got, want;
  END IF;
  RAISE NOTICE 'ok  %: %', label, got;
END $$;

-- Whole word (tier 1), prefix (tier 2), substring of the handle (tier 3).
SELECT pg_temp.expect('word', pg_temp.handles('chess'), '{example_chess_club}');
SELECT pg_temp.expect('prefix', pg_temp.handles('robo'), '{example_robotics}');
SELECT pg_temp.expect('handle substring', pg_temp.handles('unning_cl'), '{example_running_club}');
-- Caption text (content_vector) still matches: "popcorn" is only in a post.
SELECT pg_temp.expect('caption word', pg_temp.handles('popcorn'), '{example_film_society}');
-- "exam" is a prefix match (tier 2) for every club with the same rank, so
-- the id tiebreak decides the order.
SELECT pg_temp.expect('prefix ties by id', pg_temp.handles('exam'),
  '{example_chess_club,example_robotics,example_film_society,example_running_club}');
-- Category filter and total_count.
SELECT pg_temp.expect('category', pg_temp.handles('exam', 'Academic'),
  '{example_chess_club,example_robotics}');
DO $$ BEGIN
  IF (SELECT DISTINCT total_count FROM public.search_clubs_paginated('exam', 1, 2)) <> 4 THEN
    RAISE EXCEPTION 'total_count is not the full match count';
  END IF;
  IF (SELECT count(*) FROM public.search_clubs_paginated('exam', 1, 2)) <> 2 THEN
    RAISE EXCEPTION 'page size not applied';
  END IF;
  RAISE NOTICE 'ok  total_count 4 on a page of 2';
END $$;
-- Input that is tsquery or LIKE syntax must not error (or match everything).
SELECT pg_temp.expect('c++', pg_temp.handles('c++'), '{}');
SELECT pg_temp.expect('stop words only', pg_temp.handles('the of'), '{}');
SELECT pg_temp.expect('operators', pg_temp.handles('& | ! :* ( )'), '{}');
SELECT pg_temp.expect('quotes', pg_temp.handles($q$'chess"$q$), '{example_chess_club}');
SELECT pg_temp.expect('like wildcards', pg_temp.handles('%_%'), '{}');
SELECT pg_temp.expect('backslash', pg_temp.handles('\'), '{}');
SELECT pg_temp.expect('blank', pg_temp.handles('   '), '{}');

-- A new club is searchable at once, and a rename re-indexes it.
INSERT INTO public.clubs (name, instagram_handle) VALUES ('Blockchain at UCI', 'blockchainuci');
SELECT pg_temp.expect('new club, word', pg_temp.handles('blockchain'), '{blockchainuci}');
SELECT pg_temp.expect('new club, prefix', pg_temp.handles('block'), '{blockchainuci}');
SELECT pg_temp.expect('new club, substring', pg_temp.handles('chain'), '{blockchainuci}');
-- A club's own name, handle or description outranks a caption mention:
-- tier 1 (word in the name) and tier 2 (prefix) before tier 4 (posts only).
INSERT INTO public.posts (club_id, caption, post_url, determinant)
  VALUES ('00000000-0000-4000-b000-000000000001',
          'Block party with the robotics team this Friday', 'https://example.com/p/check', 'check');
SELECT public.refresh_club_search_vector();
SELECT pg_temp.expect('own word before caption', pg_temp.handles('robotics'),
  '{example_robotics,example_chess_club}');
SELECT pg_temp.expect('own prefix before caption', pg_temp.handles('block'),
  '{blockchainuci,example_chess_club}');
UPDATE public.clubs SET name = 'Distributed Ledger Society' WHERE instagram_handle = 'blockchainuci';
SELECT pg_temp.expect('renamed, new name', pg_temp.handles('ledger'), '{blockchainuci}');
SELECT pg_temp.expect('renamed, handle still matches', pg_temp.handles('blockchain'), '{blockchainuci}');
SELECT pg_temp.expect('renamed, old name gone', pg_temp.handles('Blockchain at UCI'), '{}');

ROLLBACK;
