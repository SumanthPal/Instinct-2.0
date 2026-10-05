-- Stand-ins for the bits of Supabase the migrations reference, so they apply
-- to a plain Postgres + pgvector container. Used only by scripts/db-local.sh
-- when the Supabase CLI is not installed; never run this against Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA extensions;
CREATE SCHEMA auth;

CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);

-- Same claim lookup as Supabase: set request.jwt.claim.* to impersonate a user.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.email', true), '') $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
