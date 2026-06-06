import type { OrnamentName } from "@/lib/landmarks/types";

export type OrnamentFactory = (accent: string) => any;

export const ORNAMENTS: Record<OrnamentName, OrnamentFactory> = {
  none: () => null,
  rocket: () => null,
  trophy: () => null,
  chart: () => null,
  flame: () => null,
  beacon: () => null,
  guara: () => null,
};

export const ORNAMENT_NAMES: OrnamentName[] = [
  "none",
  "rocket",
  "trophy",
  "chart",
  "flame",
  "beacon",
  "guara",
];
