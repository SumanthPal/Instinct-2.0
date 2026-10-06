-- GET /events reads events by date range, ordered by date then id.
create index if not exists events_date_id_idx on public.events (date, id);
