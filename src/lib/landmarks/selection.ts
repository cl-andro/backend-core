import type { Assignment, Landmark } from "./types.ts";
import { LANDMARK_SLOTS } from "./slots.ts";

/** Mulberry32 — 32-bit seeded PRNG, period ≈ 4B. Fast and well-known. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** cyrb53-lite: 32-bit string hash. Deterministic across platforms. */
export function hash32(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return ((h2 & 0xffff) * 0x10000 + (h1 >>> 0)) >>> 0;
}

/** Fisher-Yates with seeded RNG. Returns a new array. */
export function seededShuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface ChooseLandmarksOptions {
  /**
   * Force-include a specific slug in the selection, regardless of
   * ownership. Used for `?landmark=<slug>` deep-links from emails.
   * Silently ignored if slug not in pool.
   */
  forceIncludeSlug?: string | null;
}

/**
 * Pick slots.length landmarks from `pool` and assign them to physical slots.
 *
 * Algorithm: Efraimidis-Spirakis weighted sampling without replacement.
 * key_i = U_i^(1/w_i), pick top-k by key. Canonical choice for weighted
 * selection with zero bias.
 *
 * Force-include: landmarks owned by `loggedInLogin` (or the optional
 * deep-link slug) are guaranteed to appear in the output (up to slotCount).
 * Among the forced set, higher `priority` wins if there are more than
 * slotCount candidates.
 *
 * Pure function. No side effects.
 */
export function chooseLandmarks(
  pool: readonly Landmark[],
  seed: number,
  loggedInLogin: string | null = null,
  options: ChooseLandmarksOptions = {},
): Assignment[] {
  if (pool.length === 0) return [];

  const slotCount = LANDMARK_SLOTS.length;
  const rng = mulberry32(seed);

  // ── Step 1: force-include
  const login = loggedInLogin?.toLowerCase() ?? null;
  const forcedSlug = options.forceIncludeSlug?.toLowerCase() ?? null;

  const forcedSet = new Map<string, Landmark>();

  if (login) {
    for (const l of pool) {
      if (l.ownerGithubLogins.some((o) => o.toLowerCase() === login)) {
        forcedSet.set(l.id, l);
      }
    }
  }
  if (forcedSlug) {
    const match = pool.find((l) => l.slug.toLowerCase() === forcedSlug);
    if (match) forcedSet.set(match.id, match);
  }

  const forced = [...forcedSet.values()];
  forced.sort((a, b) => b.priority - a.priority);
  const forcedCapped = forced.slice(0, slotCount);
  const forcedIds = new Set(forcedCapped.map((l) => l.id));

  // ── Step 2: weighted random for remaining slots
  const remaining = slotCount - forcedCapped.length;
  let picked: Landmark[] = [];
  if (remaining > 0) {
    const available = pool.filter((l) => !forcedIds.has(l.id));
    const keyed = available.map((l) => ({
      landmark: l,
      key: Math.pow(rng(), 1 / Math.max(1, l.priority)),
    }));
    keyed.sort((a, b) => b.key - a.key);
    picked = keyed.slice(0, remaining).map((k) => k.landmark);
  }

  // ── Step 3: assign to physical slots
  // Highest-priority overall → prime slot. Others shuffled into standard slots.
  const chosen = [...forcedCapped, ...picked];
  chosen.sort((a, b) => b.priority - a.priority);

  const assignments: Assignment[] = [];
  if (chosen.length === 0) return assignments;

  assignments.push({ slot: LANDMARK_SLOTS[0], landmark: chosen[0] });
  const rest = seededShuffle(chosen.slice(1), rng);
  for (let i = 0; i < rest.length && i + 1 < LANDMARK_SLOTS.length; i++) {
    assignments.push({ slot: LANDMARK_SLOTS[i + 1], landmark: rest[i] });
  }
  return assignments;
}

/**
 * Compute the time-bucket seed. `bucketMs` defaults to 30 min so the
 * rotation stays stable long enough to be cacheable.
 */
export function computeSeed(
  login: string | null,
  now: number = Date.now(),
  bucketMs: number = 30 * 60 * 1000,
): number {
  const bucketId = Math.floor(now / bucketMs);
  return hash32((login ?? "anon") + ":" + bucketId);
}
