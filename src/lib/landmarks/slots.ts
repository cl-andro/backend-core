import type { Slot } from "./types";

/**
 * Physical slot geometry is part of the city layout — not DB data.
 * Slot 0 is prime: shares the south row with E.Arcade (at grid (1,-1)),
 * giving the highest-priority landmark the "next to arcade" spot.
 */
export const LANDMARK_SLOTS: readonly Slot[] = [
  { id: 0, gridX: -1, gridZ: -1, tier: "prime" },
  { id: 1, gridX: 1, gridZ: 1, tier: "standard" },
  { id: 2, gridX: -1, gridZ: 1, tier: "standard" },
] as const;
