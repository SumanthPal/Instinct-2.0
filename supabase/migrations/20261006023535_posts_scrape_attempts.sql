-- Failed scrape attempts per post; the scraper skips posts at >= 3 so a permanently broken post stops being retried.
alter table public.posts add column scrape_attempts smallint not null default 0;
