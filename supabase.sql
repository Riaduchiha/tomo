-- À coller dans Supabase > SQL Editor > Run
create table if not exists site_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
alter table site_data enable row level security;
create policy "lecture publique" on site_data for select using (true);
create policy "ecriture admin" on site_data for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;
create policy "media lecture" on storage.objects for select using (bucket_id = 'media');
create policy "media envoi" on storage.objects for insert to authenticated with check (bucket_id = 'media');
