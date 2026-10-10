-- Scraper visibility and control: a run log, a single-row pause flag and a
-- command queue. Only the backend (secret key) and the scraper touch these;
-- RLS on with no policies = no anon access, like the other internal tables.

create table public.scrape_runs (
    id uuid primary key default gen_random_uuid(),
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed', 'stopped')),
    trigger text not null default 'scheduled' check (trigger in ('scheduled', 'command', 'manual')),
    clubs_attempted integer not null default 0,
    clubs_failed integer not null default 0,
    posts_added integer not null default 0,
    error text
);
create index scrape_runs_started_at_idx on public.scrape_runs (started_at desc);
alter table public.scrape_runs enable row level security;

create table public.scraper_state (
    id boolean primary key default true check (id),
    paused boolean not null default false,
    paused_at timestamptz,
    -- Tunables the scraper reads at run start (delay also between clubs).
    club_delay_min_s integer not null default 15 check (club_delay_min_s between 5 and 600),
    club_delay_max_s integer not null default 45 check (club_delay_max_s between 5 and 600),
    page_load_timeout_s integer not null default 30 check (page_load_timeout_s between 10 and 120),
    club_timeout_s integer not null default 300 check (club_timeout_s between 60 and 1800),
    max_posts_per_club integer not null default 3 check (max_posts_per_club between 1 and 12),
    updated_at timestamptz not null default now(),
    constraint scraper_state_delay_order check (club_delay_min_s <= club_delay_max_s)
);
insert into public.scraper_state (id) values (true);
alter table public.scraper_state enable row level security;

create table public.scraper_commands (
    id uuid primary key default gen_random_uuid(),
    command text not null check (command in ('pause', 'resume', 'stop', 'run_now', 'rescrape')),
    handle text,
    status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
    result text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    constraint scraper_commands_rescrape_needs_handle check (command <> 'rescrape' or handle is not null)
);
create index scraper_commands_status_created_at_idx on public.scraper_commands (status, created_at);
alter table public.scraper_commands enable row level security;
