export type OrnamentName =
  | "none"
  | "rocket"
  | "trophy"
  | "chart"
  | "flame"
  | "beacon"
  | "guara";

export type AccentSource = "theme" | "locked";

export type BuildingKind = "tower" | "custom";

export type SlotTier = "prime" | "standard";

export interface TemplateConfig {
  /** One or two lines separated by `\n`. Each line up to 8 chars from [A-Z0-9 \-.?!]. */
  pixel_text?: string;
  /** Named bitmap registered in FACADE_BITMAPS. */
  facade_bitmap?: string;
  roof_ornament: OrnamentName;
  accent_source: AccentSource;
}

export interface Landmark {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  features: string[];
  accent: string;
  hitboxRadius: number;
  hitboxHeight: number;
  buildingKind: BuildingKind;
  customComponent: string | null;
  templateConfig: TemplateConfig | null;
  priority: number;
  ownerGithubLogins: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Slot {
  id: 0 | 1 | 2;
  gridX: number;
  gridZ: number;
  tier: SlotTier;
}

export interface Assignment {
  slot: Slot;
  landmark: Landmark;
}
