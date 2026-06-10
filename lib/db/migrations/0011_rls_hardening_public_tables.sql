-- CAST v3 Phase 7 security hardening.
--
-- CAST uses Browser -> CAST API -> PostgreSQL/Supabase.
-- The browser must not directly read or mutate CAST tables through Supabase Data API.
-- Enable RLS on all current public tables and revoke broad Data API privileges.

do $$
declare
  table_record record;
begin
  for table_record in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
    order by c.relname
  loop
    execute format('alter table %I.%I enable row level security', table_record.schema_name, table_record.table_name);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
