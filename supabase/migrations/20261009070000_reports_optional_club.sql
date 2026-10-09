-- Footer "Report a problem" reports aren't about a club, so club_id becomes
-- optional and kind gains 'site'. The FK to clubs stays. A 'club' report
-- still has to name its club.
alter table public.reports alter column club_id drop not null;

alter table public.reports drop constraint reports_kind_check;
alter table public.reports add constraint reports_kind_check
    check (kind in ('club', 'event', 'site'));

alter table public.reports add constraint reports_club_kind_has_club
    check (kind <> 'club' or club_id is not null);
