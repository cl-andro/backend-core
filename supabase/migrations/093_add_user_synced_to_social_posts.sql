-- Migration 093: Add user_synced column to social_posts table
-- Tracks if the user's browser/backend directly committed the post to their repository

alter table public.social_posts add column if not exists user_synced boolean not null default false;
