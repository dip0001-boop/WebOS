create table if not exists public.fs_nodes (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.fs_nodes(id) on delete cascade, name text not null,
  type text not null check (type in ('folder','note')), content text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade, wallpaper text default 'default', theme text default 'light', updated_at timestamptz default now()
);
create table if not exists public.window_sessions (
  user_id uuid references auth.users(id) on delete cascade, window_id text, app_id text, x int, y int, width int, height int,
  z_index int, minimized boolean default false, maximized boolean default false, primary key (user_id, window_id)
);
alter table public.fs_nodes enable row level security; alter table public.preferences enable row level security; alter table public.window_sessions enable row level security;
create policy "fs owner" on public.fs_nodes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "prefs owner" on public.preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sessions owner" on public.window_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
