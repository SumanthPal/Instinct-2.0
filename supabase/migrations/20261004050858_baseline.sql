-- Baseline of the live public schema (Postgres 15.8), dumped 2026-10-03 with
--   pg_dump --schema-only (pg_dump 17.11)
-- then filtered to the public schema plus CREATE EXTENSION statements.
-- Owners, GRANT/REVOKE and default privileges were stripped; the auth, storage,
-- realtime, vault and other Supabase-managed schemas are not included.

--
-- PostgreSQL database dump
--

\restrict SRZlOlViZhwqG3xdhxyA1Nrq5WXEhLyVmuVe6I2KzUvAszHg09OUj6ceMgUpv6n

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgsodium; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: check_like_rate_limit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_like_rate_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  recent_likes INTEGER;
BEGIN
  -- Count likes in the last hour
  SELECT COUNT(*) INTO recent_likes
  FROM user_liked_clubs
  WHERE 
    user_id = NEW.user_id AND 
    created_at > NOW() - INTERVAL '1 hour';
  
  -- Limit to 50 likes per hour
  IF recent_likes > 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many likes in the last hour';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: cleanup_orphaned_records(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_orphaned_records() RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  -- 1. Delete posts that have no club linked (orphans)
  delete from public.posts
  where club_id is not null
    and club_id not in (select id from clubs);

  -- 2. Delete posts that have NULL image_url
  delete from public.posts
  where image_url is null;

  -- 3. Optionally: You can add more cleanup later if needed
  -- Example: clean very old posts, old parsing failures, etc.
end;
$$;


--
-- Name: delete_old_events(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_old_events() RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  delete from public.events
  where date < (now() - interval '2 months');
end;
$$;


--
-- Name: delete_rejected_pending_club(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_rejected_pending_club() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only delete if someone sets approved = false
  IF NEW.approved = FALSE THEN
    DELETE FROM pending_clubs WHERE id = NEW.id;
  END IF;
  RETURN NULL; -- Important: return NULL to prevent further operations
END;
$$;


--
-- Name: get_clubs_by_category_paginated(text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_clubs_by_category_paginated(category_name text, page_offset integer, page_limit integer) RETURNS TABLE(id uuid, name text, instagram_handle text, profile_image_path text, description text, followers integer, categories jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.instagram_handle,
        c.profile_image_path,
        c.description,
        c.followers,
        COALESCE(
            jsonb_agg(
                jsonb_build_object('name', cat.name)
            ) FILTER (WHERE cat.name IS NOT NULL),
            '[]'::jsonb
        ) as categories
    FROM clubs c
    LEFT JOIN clubs_categories cc ON c.id = cc.club_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
    WHERE cat.name = category_name OR category_name IS NULL
    GROUP BY c.id, c.name, c.instagram_handle, c.profile_image_path, c.description, c.followers
    ORDER BY c.name
    LIMIT page_limit OFFSET page_offset;
END;
$$;


--
-- Name: get_clubs_for_embedding(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_clubs_for_embedding() RETURNS TABLE(id uuid, name text, description text, instagram_handle text, post_texts text, event_texts text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.description,
        c.instagram_handle,
        (
            SELECT string_agg(p.caption, ' ') 
            FROM posts p 
            WHERE p.club_id = c.id
        ) as post_texts,
        (
            SELECT string_agg(e.name || ' ' || COALESCE(e.details, ''), ' ') 
            FROM events e 
            WHERE e.club_id = c.id
        ) as event_texts
    FROM clubs c
    WHERE c.needs_embedding_update = true;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clubs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    instagram_handle text NOT NULL,
    profile_pic text,
    description text,
    updated_at timestamp without time zone DEFAULT now(),
    followers smallint DEFAULT '0'::smallint,
    following smallint DEFAULT '0'::smallint,
    club_links jsonb[] DEFAULT '{}'::jsonb[],
    last_scraped timestamp without time zone,
    search_vector tsvector,
    profile_image_path text DEFAULT 'NULL'::text,
    embedding public.vector(1536),
    needs_embedding_update boolean DEFAULT true,
    last_embedding_update timestamp without time zone,
    CONSTRAINT clubs_followers_check CHECK ((followers >= 0)),
    CONSTRAINT clubs_following_check CHECK ((following >= 0))
);


--
-- Name: COLUMN clubs.profile_image_path; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.clubs.profile_image_path IS 'used to connect bucket to club';


--
-- Name: get_never_scraped_clubs(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_never_scraped_clubs(limit_num integer) RETURNS SETOF public.clubs
    LANGUAGE sql
    AS $$
  select * from clubs
  where last_scraped is null
  order by updated_at asc
  limit limit_num
$$;


--
-- Name: get_oldest_scraped_clubs(timestamp without time zone, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_oldest_scraped_clubs(cooldown_time timestamp without time zone, limit_num integer) RETURNS SETOF public.clubs
    LANGUAGE sql
    AS $$
  select * from clubs
  where last_scraped < cooldown_time or last_scraped is null
  order by last_scraped asc nulls first
  limit limit_num
$$;


--
-- Name: get_user_liked_clubs(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_liked_clubs(user_uuid uuid) RETURNS TABLE(club_id uuid, club_name text, club_description text, club_instagram_handle text, club_profile_pic text, categories jsonb, liked_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as club_id,
    c.name as club_name,
    c.description as club_description,
    c.instagram_handle as club_instagram_handle,
    c.profile_pic as club_profile_pic,
    (
      SELECT jsonb_agg(cat.name)
      FROM club_categories cc
      JOIN categories cat ON cc.category_id = cat.id
      WHERE cc.club_id = c.id
    ) as categories,
    ulc.created_at as liked_at
  FROM clubs c
  JOIN user_liked_clubs ulc ON c.id = ulc.club_id
  WHERE ulc.user_id = user_uuid
  ORDER BY ulc.created_at DESC;
END;
$$;


--
-- Name: hybrid_search(text, public.vector, double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hybrid_search(query_text text, query_embedding public.vector, match_threshold double precision DEFAULT 0.5, fulltext_weight double precision DEFAULT 0.5, semantic_weight double precision DEFAULT 0.5) RETURNS TABLE(id uuid, name text, instagram_handle text, profile_pic text, description text, updated_at timestamp without time zone, followers smallint, following smallint, club_links jsonb[], profile_image_path text, combined_score double precision)
    LANGUAGE plpgsql
    AS $$BEGIN
    RETURN QUERY
    WITH fulltext_results AS (
        SELECT 
            c.*,
            GREATEST(
                ts_rank(c.search_vector, plainto_tsquery('english', query_text)),
                similarity(c.name, query_text)
            ) AS text_score
        FROM 
            clubs c
        WHERE 
            c.search_vector @@ plainto_tsquery('english', query_text)
            OR c.name % query_text
    ),
    semantic_results AS (
        SELECT 
            c.*,
            1 - (c.embedding <=> query_embedding) AS semantic_score
        FROM 
            clubs c
        WHERE 
            c.embedding IS NOT NULL
            AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ),
    combined_results AS (
        SELECT 
            COALESCE(f.id, s.id) AS id,
            COALESCE(f.name, s.name) AS name,
            COALESCE(f.instagram_handle, s.instagram_handle) AS instagram_handle,
            COALESCE(f.profile_pic, s.profile_pic) AS profile_pic,
            COALESCE(f.description, s.description) AS description,
            COALESCE(f.updated_at, s.updated_at) AS updated_at,
            COALESCE(f.followers, s.followers) AS followers,
            COALESCE(f.following, s.following) AS following,
            COALESCE(f.club_links, s.club_links) AS club_links,
            COALESCE(f.profile_image_path, s.profile_image_path) AS profile_image_path,
            COALESCE(f.text_score, 0) * fulltext_weight + 
            COALESCE(s.semantic_score, 0) * semantic_weight AS combined_score
        FROM 
            fulltext_results f 
        FULL OUTER JOIN 
            semantic_results s ON f.id = s.id
        WHERE
            COALESCE(f.text_score, 0) * fulltext_weight + 
            COALESCE(s.semantic_score, 0) * semantic_weight > 0
    )
    SELECT * FROM combined_results
    ORDER BY combined_score DESC;
END;$$;


--
-- Name: refresh_club_search_vector(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_club_search_vector() RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  update clubs
  set search_vector = 
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(instagram_handle, '')), 'C') ||
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
  WHERE TRUE; -- 🛠✅ This is the important fix
end;
$$;


--
-- Name: search_clubs_paginated(text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_clubs_paginated(search_query text, page_offset integer, page_limit integer, filter_category text DEFAULT NULL::text) RETURNS TABLE(id uuid, name text, instagram_handle text, profile_image_path text, description text, categories jsonb, total_count bigint)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    c.id,
    c.name,
    c.instagram_handle,
    c.profile_image_path,
    c.description,
    (
      SELECT jsonb_agg(jsonb_build_object('name', cat.name))
      FROM clubs_categories cc
      JOIN categories cat ON cc.category_id = cat.id
      WHERE cc.club_id = c.id
    ) AS categories,
    COUNT(*) OVER() AS total_count
  FROM clubs c
  WHERE c.search_vector @@ plainto_tsquery('english', search_query)
    AND (filter_category IS NULL OR EXISTS (
      SELECT 1
      FROM clubs_categories cc
      JOIN categories cat ON cc.category_id = cat.id
      WHERE cc.club_id = c.id AND cat.name = filter_category
    ))
  ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', search_query)) DESC
  LIMIT page_limit OFFSET page_offset;
$$;


--
-- Name: update_club_embedding_on_post_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_club_embedding_on_post_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Mark the associated club as needing an embedding update
  UPDATE clubs SET needs_embedding_update = TRUE 
  WHERE id = NEW.club_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_photo_reload_flags(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_photo_reload_flags() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE posts
  SET photo_reload = TRUE
  WHERE scrapped = TRUE
    AND (NOW() - posted) > INTERVAL '5 days'
    AND (photo_reload IS NULL OR photo_reload = FALSE);
END;
$$;


--
-- Name: calendar_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    ics_content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);


--
-- Name: clubs_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clubs_categories (
    club_id uuid NOT NULL,
    category_id uuid NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    post_id uuid,
    name text NOT NULL,
    date timestamp without time zone NOT NULL,
    details text,
    duration interval,
    parsed jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: pending_clubs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    instagram_handle text NOT NULL,
    categories jsonb NOT NULL,
    submitted_by_email text NOT NULL,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    reviewed_by_email text,
    reviewed_at timestamp without time zone
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    caption text,
    image_url text,
    posted timestamp without time zone,
    post_url text,
    scrapped boolean,
    determinant text DEFAULT ''::text,
    created_at date DEFAULT now(),
    parsed boolean DEFAULT false NOT NULL,
    image_path text DEFAULT 'NULL'::text
);


--
-- Name: user_liked_clubs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_liked_clubs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    instagram_handle text
);


--
-- Name: calendar_files calendar_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_files
    ADD CONSTRAINT calendar_files_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: clubs_categories clubs_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs_categories
    ADD CONSTRAINT clubs_categories_pkey PRIMARY KEY (club_id, category_id);


--
-- Name: clubs clubs_instagram_handle_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_instagram_handle_key UNIQUE (instagram_handle);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: pending_clubs pending_clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_clubs
    ADD CONSTRAINT pending_clubs_pkey PRIMARY KEY (id);


--
-- Name: posts posts_determinant_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_determinant_key UNIQUE (determinant);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: user_liked_clubs uq_user_club_instagram; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_liked_clubs
    ADD CONSTRAINT uq_user_club_instagram UNIQUE (user_id, instagram_handle);


--
-- Name: user_liked_clubs user_liked_clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_liked_clubs
    ADD CONSTRAINT user_liked_clubs_pkey PRIMARY KEY (id);


--
-- Name: user_liked_clubs user_liked_clubs_user_id_club_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_liked_clubs
    ADD CONSTRAINT user_liked_clubs_user_id_club_id_key UNIQUE (user_id, club_id);


--
-- Name: idx_clubs_last_scraped; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clubs_last_scraped ON public.clubs USING btree (last_scraped);


--
-- Name: idx_clubs_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clubs_name_trgm ON public.clubs USING gin (name public.gin_trgm_ops);


--
-- Name: idx_clubs_scrape_handle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clubs_scrape_handle ON public.clubs USING btree (last_scraped, instagram_handle);


--
-- Name: idx_clubs_search_vector; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clubs_search_vector ON public.clubs USING gin (search_vector);


--
-- Name: idx_user_liked_clubs_club_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_liked_clubs_club_id ON public.user_liked_clubs USING btree (club_id);


--
-- Name: idx_user_liked_clubs_instagram_handle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_liked_clubs_instagram_handle ON public.user_liked_clubs USING btree (instagram_handle);


--
-- Name: idx_user_liked_clubs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_liked_clubs_user_id ON public.user_liked_clubs USING btree (user_id);


--
-- Name: pending_clubs auto_delete_rejected_club; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER auto_delete_rejected_club AFTER UPDATE ON public.pending_clubs FOR EACH ROW WHEN ((new.approved = false)) EXECUTE FUNCTION public.delete_rejected_pending_club();


--
-- Name: user_liked_clubs enforce_like_rate_limit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_like_rate_limit BEFORE INSERT ON public.user_liked_clubs FOR EACH ROW EXECUTE FUNCTION public.check_like_rate_limit();


--
-- Name: calendar_files calendar_files_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_files
    ADD CONSTRAINT calendar_files_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: clubs_categories clubs_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs_categories
    ADD CONSTRAINT clubs_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: clubs_categories clubs_categories_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clubs_categories
    ADD CONSTRAINT clubs_categories_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: events events_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: events events_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: posts posts_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: user_liked_clubs user_liked_clubs_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_liked_clubs
    ADD CONSTRAINT user_liked_clubs_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: user_liked_clubs user_liked_clubs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_liked_clubs
    ADD CONSTRAINT user_liked_clubs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clubs Only UCI emails allowed; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only UCI emails allowed" ON public.clubs USING ((auth.email() ~~ '%@uci.edu'::text));


--
-- Name: user_liked_clubs Users can create their own likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own likes" ON public.user_liked_clubs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_liked_clubs Users can delete their own likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own likes" ON public.user_liked_clubs FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_liked_clubs Users can view their own likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own likes" ON public.user_liked_clubs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_liked_clubs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_liked_clubs ENABLE ROW LEVEL SECURITY;

