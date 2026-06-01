-- ============================================================
-- Git City — Add user repositories for social media posts
-- ============================================================

-- Table to track repositories assigned to users for their social media posts
create table if not exists user_repos (
  id            bigint generated always as identity primary key,
  user_id       bigint references developers(id) on delete cascade,
  repo_name     text not null,
  repo_url      text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(user_id, repo_name)
);

-- Indexes for performance
create index if not exists idx_user_repos_user_id on user_repos (user_id);
create index if not exists idx_user_repos_created_at on user_repos (created_at desc);

-- Trigger to automatically update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language 'plpgsql';

create trigger update_user_repos_updated_at
  before update on user_repos
  for each row
  execute procedure update_updated_at_column();

-- Add column to developers table to track assigned repository
alter table developers
  add column if not exists assigned_repo text,
  add column if not exists assigned_repo_url text,
  add column if not exists repo_assigned_at timestamptz;

-- Index for assigned repository lookup
create index if not exists idx_developers_assigned_repo on developers (assigned_repo) where assigned_repo is not null;