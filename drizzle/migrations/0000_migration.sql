create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'مستخدم',
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  author text,
  source text,
  category text,
  media_type text not null default 'video' check (media_type in ('audio','video')),
  media_url text not null,
  cover_url text,
  gif_url text,
  duration_seconds numeric,
  plays_count integer not null default 0,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.clips to anon, authenticated;
grant insert, delete on public.clips to authenticated;
grant all on public.clips to service_role;
alter table public.clips enable row level security;
create policy "clips public read" on public.clips for select using (true);
create policy "insert own clips" on public.clips for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own clips" on public.clips for delete to authenticated using (auth.uid() = user_id);

create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);