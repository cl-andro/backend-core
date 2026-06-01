-- Migration 094: Add github_token column to developers table
-- Stores the user's GitHub OAuth provider_token for direct writes

alter table public.developers add column if not exists github_token text;
