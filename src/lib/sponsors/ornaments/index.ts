import type * as THREE from "three";
import type { OrnamentName } from "@/lib/landmarks/types";
import { createRocket } from "./rocket";
import { createTrophy } from "./trophy";
import { createFlame } from "./flame";
import { createGuaraMascot } from "./guara";
import { createChart } from "./chart";
import { createBeacon } from "./beacon";
import { createNone } from "./none";

export type OrnamentFactory = (accent: string) => THREE.Group;

export const ORNAMENTS: Record<OrnamentName, OrnamentFactory> = {
  none: () => createNone(),
  rocket: createRocket,
  trophy: createTrophy,
  chart: createChart,
  flame: createFlame,
  beacon: createBeacon,
  guara: createGuaraMascot,
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
