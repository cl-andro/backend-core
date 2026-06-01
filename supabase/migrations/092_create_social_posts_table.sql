-- ============================================================
-- Git Social — Create social_posts, social_comments, and social_likes tables
-- ============================================================

-- 1. Create social_posts table
create table if not exists social_posts (
  id                  bigint generated always as identity primary key,
  developer_id        bigint not null references developers(id) on delete cascade,
  content             text not null,
  github_issue_number int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 2. Create social_comments table
create table if not exists social_comments (
  id                  bigint generated always as identity primary key,
  post_id             bigint not null references social_posts(id) on delete cascade,
  developer_id        bigint not null references developers(id) on delete cascade,
  content             text not null,
  created_at          timestamptz not null default now()
);

-- 3. Create social_likes table (tracks likes/reactions)
create table if not exists social_likes (
  id                  bigint generated always as identity primary key,
  post_id             bigint not null references social_posts(id) on delete cascade,
  developer_id        bigint not null references developers(id) on delete cascade,
  unique(post_id, developer_id)
);

-- 4. Create performance indexes
create index if not exists idx_social_posts_developer_id on social_posts (developer_id);
create index if not exists idx_social_posts_created_at on social_posts (created_at desc);
create index if not exists idx_social_comments_post_id on social_comments (post_id);
create index if not exists idx_social_likes_post_id on social_likes (post_id);

-- 5. Enable RLS
alter table social_posts enable row level security;
alter table social_comments enable row level security;
alter table social_likes enable row level security;

-- 6. Define RLS policies
-- Anyone (anon/authenticated) can read posts, comments, and likes
create policy "Public read posts" on social_posts for select using (true);
create policy "Public read comments" on social_comments for select using (true);
create policy "Public read likes" on social_likes for select using (true);

-- Authenticated users can insert/delete their own posts
create policy "Claimed users can insert own posts" on social_posts
  for insert with check (
    developer_id = (select id from public.developers where claimed_by = auth.uid() limit 1)
  );

create policy "Claimed users can delete own posts" on social_posts
  for delete using (
    developer_id = (select id from public.developers where claimed_by = auth.uid() limit 1)
  );

-- Authenticated users can insert/delete their own comments
create policy "Claimed users can insert own comments" on social_comments
  for insert with check (
    developer_id = (select id from public.developers where claimed_by = auth.uid() limit 1)
  );

create policy "Claimed users can delete own comments" on social_comments
  for delete using (
    developer_id = (select id from public.developers where claimed_by = auth.uid() limit 1)
  );

-- Authenticated users can toggle (insert/delete) their own likes
create policy "Claimed users can insert own likes" on social_likes
  for insert with check (
    developer_id = (select id from public.developers where claimed_by = auth.uid() limit 1)
  );

create policy "Claimed users can delete own likes" on social_likes
  for delete using (
    developer_id = (select id from public.developers where claimed_by = auth.uid() limit 1)
  );
