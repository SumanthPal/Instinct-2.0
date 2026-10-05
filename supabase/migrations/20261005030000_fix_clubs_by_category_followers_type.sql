-- get_clubs_by_category_paginated declares followers integer, but
-- clubs.followers is smallint, so every call failed with "structure of query
-- does not match function result type" and /club?category= fell back to a
-- slower path. Cast in the body so the return type (the API contract) stays
-- integer. Same signature and return type, so CREATE OR REPLACE keeps the
-- function's owner, grants and SECURITY INVOKER as they are in prod.

CREATE OR REPLACE FUNCTION public.get_clubs_by_category_paginated(category_name text, page_offset integer, page_limit integer) RETURNS TABLE(id uuid, name text, instagram_handle text, profile_image_path text, description text, followers integer, categories jsonb)
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
        c.followers::integer,
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
