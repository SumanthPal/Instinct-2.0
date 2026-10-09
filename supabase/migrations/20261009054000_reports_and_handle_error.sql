-- User reports ("Something wrong?") triaged by admin bots via /admin and /mcp.
create table public.reports (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('club', 'event')),
    category text not null check (category in ('wrong_info', 'wrong_time_place', 'wrong_instagram', 'broken_image', 'other')),
    club_id uuid not null references public.clubs (id) on delete cascade,
    event_id uuid,
    page_url text not null,
    note text not null,
    email text,
    status text not null default 'open' check (status in ('open', 'resolved')),
    created_at timestamptz not null default now()
);
create index reports_status_created_at_idx on public.reports (status, created_at);
-- Only the backend (secret key) touches this table; no policies = no anon access.
alter table public.reports enable row level security;

-- Set by the scraper when a club's Instagram handle is missing/renamed; the club is skipped until an admin fixes the handle.
alter table public.clubs add column handle_error text;
