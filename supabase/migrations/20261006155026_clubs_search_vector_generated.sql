-- Club search: always-current vectors and word / prefix / substring matching.
--
-- clubs.search_vector was only filled by refresh_club_search_vector(), a batch
-- job the current daily scrape never runs, so clubs added or edited since
-- (36 of 451 on prod, including blockchainuci) were missing from search.
--
-- 1. search_vector becomes a STORED generated column over the club's own
--    fields, so it is right the moment a row is written:
--      name (A), instagram_handle split on . and _ (A), description (B).
-- 2. Post captions and event names/details, the bulk of what search matches
--    on prod, cannot go in a generated column (other tables). They move to
--    content_vector (D), still filled by refresh_club_search_vector(), which
--    this migration runs once. Nothing writes search_vector any more.
-- 3. search_clubs_paginated keeps its signature and columns. A club matches
--    in the first of four tiers that applies, ranked in that order:
--      1. every word of the query in the club's name, handle or description
--      2. every word as a prefix of a word there ("block" -> Blockchain at UCI)
--      3. the query as a substring of the name or handle, or a close trigram
--         match on the name ("chain" -> blockchainuci, typos)
--      4. every word somewhere in the club's text including its posts and
--         events (what search matched on before)
--    then by rank within the tier and by id. Matches on the club itself come
--    before caption mentions, which on prod otherwise bury the club named
--    after the query ("block": 17 clubs mention it in posts). Query text is never parsed as
--    tsquery syntax: prefix terms are built from alphanumeric runs only, and
--    LIKE wildcards are escaped, so input like "c++", "&" or quotes is safe.

ALTER TABLE public.clubs DROP COLUMN search_vector; -- drops idx_clubs_search_vector
ALTER TABLE public.clubs ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, translate(coalesce(instagram_handle, ''), '._', '  ')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')
) STORED;
CREATE INDEX idx_clubs_search_vector ON public.clubs USING gin (search_vector);

ALTER TABLE public.clubs ADD COLUMN content_vector tsvector;
COMMENT ON COLUMN public.clubs.content_vector IS
  'Post captions and event text for search; filled by refresh_club_search_vector()';

CREATE OR REPLACE FUNCTION public.refresh_club_search_vector() RETURNS void
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
    AS $$
begin
  -- search_vector is generated; this keeps the cross-table part current.
  update clubs
  set content_vector =
    setweight(
      to_tsvector('english',
        coalesce((select string_agg(caption, ' ') from posts where posts.club_id = clubs.id), '')
      ),
      'D'
    ) ||
    setweight(
      to_tsvector('english',
        coalesce((select string_agg(name || ' ' || coalesce(details, ''), ' ')
          from events where events.club_id = clubs.id), '')
      ),
      'D'
    )
  where true;
end;
$$;

SELECT public.refresh_club_search_vector();

CREATE OR REPLACE FUNCTION public.search_clubs_paginated(search_query text, page_offset integer, page_limit integer, filter_category text DEFAULT NULL::text)
    RETURNS TABLE(id uuid, name text, instagram_handle text, profile_image_path text, description text, categories jsonb, total_count bigint)
    LANGUAGE sql STABLE
    SET search_path = public, pg_temp
    -- A seq scan over a few hundred clubs is the plan; JIT compiling it costs
    -- more than running it.
    SET jit = off
    AS $$
  WITH q AS (
    -- A tsquery is only built when to_tsvector finds lexemes, so a query of
    -- stop words or punctuation skips those tiers (NULL) without notices.
    SELECT
      CASE WHEN length(to_tsvector('english', search_query)) > 0
        THEN plainto_tsquery('english', search_query) END AS words,
      -- Each run of letters/digits (2+ chars, not a stop word) as an English
      -- prefix term, ANDed. Alphanumerics only, so no tsquery syntax gets in.
      (SELECT to_tsquery('english', string_agg(tok || ':*', ' & '))
         FROM regexp_split_to_table(lower(search_query), '[^[:alnum:]]+') AS tok
        WHERE length(tok) >= 2 AND length(to_tsvector('english', tok)) > 0) AS prefix,
      lower(btrim(search_query)) AS needle,
      -- The query as a literal ILIKE substring (wildcards escaped).
      '%' || replace(replace(replace(lower(btrim(search_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern
  ),
  matched AS (
    SELECT c.id, c.name, c.instagram_handle, c.profile_image_path, c.description,
           t.tier,
           CASE t.tier
             WHEN 1 THEN ts_rank_cd(c.search_vector, q.words)
             WHEN 2 THEN ts_rank_cd(c.search_vector, q.prefix)
             WHEN 3 THEN greatest(word_similarity(q.needle, c.name), similarity(q.needle, c.instagram_handle))
             WHEN 4 THEN ts_rank_cd(c.search_vector || coalesce(c.content_vector, ''::tsvector), q.words)
           END AS score
    FROM clubs c
    CROSS JOIN q
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN c.search_vector @@ q.words THEN 1
        WHEN c.search_vector @@ q.prefix THEN 2
        WHEN length(q.needle) >= 3
         AND (c.name ILIKE q.pattern OR c.instagram_handle ILIKE q.pattern OR q.needle <% c.name) THEN 3
        WHEN (c.search_vector || coalesce(c.content_vector, ''::tsvector)) @@ q.words THEN 4
      END AS tier
    ) t
    WHERE t.tier IS NOT NULL
      AND (filter_category IS NULL OR EXISTS (
        SELECT 1
        FROM clubs_categories cc
        JOIN categories cat ON cc.category_id = cat.id
        WHERE cc.club_id = c.id AND cat.name = filter_category
      ))
  )
  SELECT
    m.id,
    m.name,
    m.instagram_handle,
    m.profile_image_path,
    m.description,
    (
      SELECT jsonb_agg(jsonb_build_object('name', cat.name))
      FROM clubs_categories cc
      JOIN categories cat ON cc.category_id = cat.id
      WHERE cc.club_id = m.id
    ) AS categories,
    COUNT(*) OVER () AS total_count
  FROM matched m
  ORDER BY m.tier, m.score DESC, m.id
  LIMIT page_limit OFFSET page_offset;
$$;
