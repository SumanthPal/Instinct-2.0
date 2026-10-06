-- Small FAKE dataset for local development, tests and agents. Every club,
-- handle, post and event here is made up. Loaded by scripts/db-local.sh
-- (make db-local / make db-reset). For real data, use the gitignored
-- supabase/seed.local.sql instead; see the README.

INSERT INTO public.categories (id, name) VALUES
  ('00000000-0000-4000-a000-000000000001', 'Academic'),
  ('00000000-0000-4000-a000-000000000002', 'Arts & Culture'),
  ('00000000-0000-4000-a000-000000000003', 'Technology'),
  ('00000000-0000-4000-a000-000000000004', 'Health & Fitness');

-- Images are explicit: one club and one post have a (fake) object key, the
-- rest have none (NULL, never the string 'NULL').
INSERT INTO public.clubs (id, name, instagram_handle, description, followers, following, club_links, last_scraped, profile_image_path) VALUES
  ('00000000-0000-4000-b000-000000000001', 'Example Chess Club', 'example_chess_club',
   'Fake club for local testing. Casual and rated chess every week.', 420, 80,
   ARRAY['{"url": "https://example.com/chess", "text": "Club website"}'::jsonb], now() - interval '2 days',
   'pfps/example_chess_club.jpg'),
  ('00000000-0000-4000-b000-000000000002', 'Example Robotics Team', 'example_robotics',
   'Fake club for local testing. We build robots and enter competitions.', 1210, 150,
   ARRAY['{"url": "https://example.com/robotics", "text": "Join our Discord"}'::jsonb], now() - interval '1 day', NULL),
  ('00000000-0000-4000-b000-000000000003', 'Example Film Society', 'example_film_society',
   'Fake club for local testing. Weekly screenings and discussions.', 305, 60,
   '{}', NULL, NULL),
  ('00000000-0000-4000-b000-000000000004', 'Example Running Club', 'example_running_club',
   'Fake club for local testing. Morning runs around campus.', 890, 120,
   '{}', now() - interval '5 days', NULL);

INSERT INTO public.clubs_categories (club_id, category_id) VALUES
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000004');

INSERT INTO public.posts (id, club_id, caption, posted, post_url, scrapped, determinant, parsed, image_path) VALUES
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001',
   'Blitz tournament next Friday at 6pm in the student center! All levels welcome.',
   now() - interval '3 days', 'https://example.com/p/fake-chess-1', true, 'fake-chess-1', true,
   'posts/example_chess_club/00000000-0000-4000-c000-000000000001'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001',
   'Thanks to everyone who came to our first meeting of the quarter.',
   now() - interval '10 days', 'https://example.com/p/fake-chess-2', true, 'fake-chess-2', true, NULL),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000002',
   'Build night this Wednesday, 7pm in the engineering lab. Pizza provided.',
   now() - interval '2 days', 'https://example.com/p/fake-robotics-1', true, 'fake-robotics-1', true, NULL),
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000003',
   'Screening a classic this Thursday at 8pm. Free popcorn!',
   now() - interval '1 day', 'https://example.com/p/fake-film-1', true, 'fake-film-1', false, NULL),
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000004',
   'Saturday 7am group run, meet at the flagpole.',
   now() - interval '4 days', 'https://example.com/p/fake-running-1', true, 'fake-running-1', true, NULL);

INSERT INTO public.events (club_id, post_id, name, date, details, duration) VALUES
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001',
   'Blitz Tournament', date_trunc('day', now()) + interval '6 days 18 hours',
   'Student center, all levels welcome.', interval '3 hours'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-000000000003',
   'Build Night', date_trunc('day', now()) + interval '3 days 19 hours',
   'Engineering lab. Pizza provided.', interval '2 hours'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-c000-000000000005',
   'Saturday Group Run', date_trunc('day', now()) + interval '2 days 7 hours',
   'Meet at the flagpole.', interval '1 hour'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000002',
   'First Meeting', date_trunc('day', now()) - interval '10 days' + interval '18 hours',
   'Past event, kept so date filters have something to exclude.', interval '1 hour');

-- Fill clubs.content_vector (post and event text) for search. search_vector
-- is a generated column and needs nothing.
DO $$ BEGIN PERFORM public.refresh_club_search_vector(); END $$;
