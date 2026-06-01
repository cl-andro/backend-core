-- ─── Force Push PvP System (production-hardened) ────────────
-- Server-authoritative PvP for fly mode.
-- Enforces per-day caps (50 XP, 3 kills/target), idempotent crediting,
-- and is locked down to service_role access only.

BEGIN;

-- ─── Audit log table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pvp_kill_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  killer_id     bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  target_id     bigint NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  xp_granted    integer NOT NULL DEFAULT 0,
  happy_hour    boolean NOT NULL DEFAULT false,
  kill_token    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pvp_kill_log_no_self_kill CHECK (killer_id <> target_id),
  CONSTRAINT pvp_kill_log_xp_bounds CHECK (xp_granted >= 0 AND xp_granted <= 50),
  CONSTRAINT pvp_kill_log_token_nonempty CHECK (kill_token <> ''),
  CONSTRAINT pvp_kill_log_token_unique UNIQUE (kill_token)
);

-- Note: indexing `created_at::date` directly is not allowed because the
-- timestamptz→date cast depends on the session timezone and is not
-- IMMUTABLE. Pinning to UTC makes the expression IMMUTABLE and lets us
-- index it. Queries inside pvp_credit_kill use the same expression so
-- the planner can hit these indexes.
CREATE INDEX IF NOT EXISTS idx_pvp_kill_log_killer_day
  ON pvp_kill_log(killer_id, ((created_at AT TIME ZONE 'UTC')::date));
CREATE INDEX IF NOT EXISTS idx_pvp_kill_log_killer_target_day
  ON pvp_kill_log(killer_id, target_id, ((created_at AT TIME ZONE 'UTC')::date));
CREATE INDEX IF NOT EXISTS idx_pvp_kill_log_created_at
  ON pvp_kill_log(created_at);

-- ─── Lock down access ──────────────────────────────────────
-- All access is through the pvp_credit_kill RPC called by the API using
-- the service_role admin client. PostgREST clients have no business here.
ALTER TABLE pvp_kill_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pvp_kill_log FROM PUBLIC, anon, authenticated;

-- ─── Atomic credit RPC ─────────────────────────────────────
-- Validates caps, inserts the audit row, and grants XP in a single
-- transaction. Idempotent via the UNIQUE kill_token constraint.
--
-- SECURITY DEFINER: runs as the function owner (service role) which has
-- the necessary privileges. search_path is pinned to public to prevent
-- search_path injection attacks.
CREATE OR REPLACE FUNCTION pvp_credit_kill(
  p_killer_id  bigint,
  p_target_id  bigint,
  p_base_xp    integer,
  p_happy_hour boolean,
  p_kill_token text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  -- All cap math is done in UTC so it matches the expression indexes on
  -- pvp_kill_log. Day boundaries roll over at 00:00 UTC regardless of the
  -- session timezone.
  v_today                date := (now() AT TIME ZONE 'UTC')::date;
  v_xp_today             integer;
  v_kills_target_today   integer;
  v_grantable            integer;
  v_inserted_id          uuid;
BEGIN
  -- Defensive input checks (also enforced by API and by table CHECK constraints).
  IF p_killer_id IS NULL OR p_target_id IS NULL THEN
    RETURN json_build_object('granted', 0, 'reason', 'invalid_ids');
  END IF;
  IF p_killer_id = p_target_id THEN
    RETURN json_build_object('granted', 0, 'reason', 'self_kill');
  END IF;
  IF p_base_xp IS NULL OR p_base_xp <= 0 OR p_base_xp > 50 THEN
    RETURN json_build_object('granted', 0, 'reason', 'invalid_xp');
  END IF;
  IF p_kill_token IS NULL OR length(p_kill_token) < 8 OR length(p_kill_token) > 256 THEN
    RETURN json_build_object('granted', 0, 'reason', 'invalid_token');
  END IF;

  -- Serialize concurrent credits for the same killer to avoid cap races.
  -- Locking the developer row is cheap and consistent with grant_xp's
  -- expected access pattern.
  PERFORM 1 FROM developers WHERE id = p_killer_id FOR UPDATE;

  -- Read current daily stats inside the lock. Expression matches the
  -- index `((created_at AT TIME ZONE 'UTC')::date)` for fast lookup.
  SELECT COALESCE(SUM(xp_granted), 0) INTO v_xp_today
  FROM pvp_kill_log
  WHERE killer_id = p_killer_id
    AND (created_at AT TIME ZONE 'UTC')::date = v_today;

  SELECT COUNT(*)::int INTO v_kills_target_today
  FROM pvp_kill_log
  WHERE killer_id = p_killer_id
    AND target_id = p_target_id
    AND (created_at AT TIME ZONE 'UTC')::date = v_today;

  IF v_kills_target_today >= 3 THEN
    RETURN json_build_object('granted', 0, 'reason', 'target_cap');
  END IF;

  v_grantable := LEAST(p_base_xp, GREATEST(0, 50 - v_xp_today));
  IF v_grantable <= 0 THEN
    RETURN json_build_object('granted', 0, 'reason', 'daily_cap');
  END IF;

  -- Atomic insert. UNIQUE(kill_token) guarantees idempotency even under
  -- replay attacks or concurrent inserts.
  INSERT INTO pvp_kill_log (killer_id, target_id, xp_granted, happy_hour, kill_token)
  VALUES (p_killer_id, p_target_id, v_grantable, p_happy_hour, p_kill_token)
  ON CONFLICT (kill_token) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Token was already used. Do not grant XP again.
    RETURN json_build_object('granted', 0, 'reason', 'already_credited');
  END IF;

  -- Grant the XP in the same transaction. If grant_xp errors, the kill log
  -- insert above is rolled back, keeping audit and balance consistent.
  PERFORM grant_xp(p_killer_id, 'force_push', v_grantable);

  RETURN json_build_object(
    'granted', v_grantable,
    'happy_hour', p_happy_hour,
    'log_id', v_inserted_id
  );
END;
$$;

-- Lock execution to the function owner (service role). Direct RPC from
-- anon/authenticated would otherwise let any logged-in user attempt to
-- credit a kill against themselves.
REVOKE EXECUTE ON FUNCTION pvp_credit_kill(bigint, bigint, integer, boolean, text) FROM PUBLIC;

-- ─── Retention helper (call from a scheduled job; we are not enabling
-- pg_cron here, so the job runner / vercel cron should call this daily) ─
CREATE OR REPLACE FUNCTION pvp_kill_log_prune(p_keep_days integer DEFAULT 35)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM pvp_kill_log
  WHERE created_at < (now() - make_interval(days => p_keep_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION pvp_kill_log_prune(integer) FROM PUBLIC;

COMMIT;
