-- ============================================================
-- Migration 086: Dynamic Landmarks pool
-- Safe to run multiple times (IF NOT EXISTS + EXCEPTION guards)
-- ============================================================
-- Decouples the 3 physical landmark slots (in code) from the
-- active pool (N rows here). page.tsx picks 3 at render time
-- via deterministic weighted selection.
-- ============================================================

CREATE TABLE IF NOT EXISTS landmarks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text UNIQUE NOT NULL,

  -- Card data
  name                 text NOT NULL,
  tagline              text NOT NULL,
  description          text NOT NULL,
  url                  text NOT NULL,
  features             jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Rendering
  accent               text NOT NULL,
  hitbox_radius        integer NOT NULL DEFAULT 80,
  hitbox_height        integer NOT NULL DEFAULT 500,

  -- Geometry selector
  building_kind        text NOT NULL DEFAULT 'tower'
                       CHECK (building_kind IN ('custom', 'tower')),
  custom_component     text,
  template_config      jsonb,

  -- Rotation
  priority             integer NOT NULL DEFAULT 100 CHECK (priority >= 0),

  -- Ownership (force-include when listed login authenticated)
  owner_github_logins  text[] NOT NULL DEFAULT '{}',

  -- Lifecycle
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT landmarks_kind_config CHECK (
    (building_kind = 'custom' AND custom_component IS NOT NULL)
    OR (building_kind = 'tower' AND template_config IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS landmarks_active_idx
  ON landmarks (active)
  WHERE active;

ALTER TABLE landmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public reads active landmarks" ON landmarks
    FOR SELECT USING (active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION landmarks_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER landmarks_updated_at
  BEFORE UPDATE ON landmarks
  FOR EACH ROW EXECUTE FUNCTION landmarks_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON landmarks TO anon, authenticated;
