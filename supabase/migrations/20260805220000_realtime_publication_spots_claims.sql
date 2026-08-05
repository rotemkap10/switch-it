-- Realtime publication for live handoff invalidation.
-- Only parking_spots and claims. No profiles, secrets, or credit_transactions.
-- RLS policies are unchanged; Realtime still respects SELECT policies for
-- INSERT/UPDATE. Clients treat events as refresh signals only.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'parking_spots'
  ) then
    alter publication supabase_realtime add table public.parking_spots;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'claims'
  ) then
    alter publication supabase_realtime add table public.claims;
  end if;
end
$$;

comment on table public.parking_spots is
  'Published parking spots. Included in supabase_realtime for live UI invalidation; RLS unchanged.';

comment on table public.claims is
  'Parking claims. Included in supabase_realtime for live UI invalidation; RLS unchanged.';
