import type { ComponentType } from "react";
import FirecrawlBuilding from "./buildings/FirecrawlBuilding";
import GuaraCloudBuilding from "./buildings/GuaraCloudBuilding";
import SolanaHackathonBuilding from "./buildings/SolanaHackathonBuilding";

// ─── Grid constants (must match github.ts) ──────────────────
const BLOCK_FOOTPRINT_X = 161; // 4*38 + 3*3
const BLOCK_FOOTPRINT_Z = 137; // 4*32 + 3*3
const STREET_W = 12;

/** Convert grid coordinates to world position. */
export function gridToWorldPos(
  gridX: number,
  gridZ: number,
): [number, number, number] {
  const x = gridX * (BLOCK_FOOTPRINT_X + STREET_W);
  const z = gridZ * (BLOCK_FOOTPRINT_Z + STREET_W);
  return [x, 0, z];
}

// ─── Types ──────────────────────────────────────────────────

export interface SponsorBuildingProps {
  themeAccent: string;
  themeWindowLit: string[];
  themeFace: string;
}

export interface SponsorConfig {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  accent: string;
  gridX: number;
  gridZ: number;
  features: string[];
  /** Visual 3D building component — receives theme props only. */
  Building: ComponentType<SponsorBuildingProps>;
  /** Invisible cylinder hitbox radius. */
  hitboxRadius: number;
  /** Invisible cylinder hitbox height. */
  hitboxHeight: number;
  /** SVG element for the card logo (24×24 viewBox). */
  logoSvg?: React.ReactNode;
}

// ─── Registry ───────────────────────────────────────────────

export const SPONSORS: SponsorConfig[] = [
  {
    slug: "guaracloud",
    name: "Guara Cloud",
    tagline: "Deploy in seconds",
    description:
      "Brazilian cloud for developers. Git-based auto deploys, free HTTPS, real-time metrics, autoscaling, and billing in BRL. LGPD-compliant out of the box.",
    url: "https://guaracloud.com",
    accent: "#8b5cf6",
    gridX: -1,
    gridZ: 1,
    features: ["Git-based deploys", "Autoscaling", "Billing in BRL"],
    Building: GuaraCloudBuilding,
    hitboxRadius: 80,
    hitboxHeight: 450,
    logoSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 16a4 4 0 0 1-.5-7.97A6 6 0 0 1 17.5 8.5a4.5 4.5 0 0 1 .5 8.97H6Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    slug: "firecrawl",
    name: "Firecrawl",
    tagline: "Power AI agents with clean web data",
    description:
      "The API to search, scrape, and interact with the web at scale. Open source, battle-tested, and built for AI agents. Clean markdown and structured data, ready to feed your LLM.",
    url: "https://www.firecrawl.dev/",
    accent: "#ff5c1f",
    gridX: -1,
    gridZ: -1,
    features: ["Scrape + crawl API", "Open source", "LLM-ready markdown"],
    Building: FirecrawlBuilding,
    hitboxRadius: 80,
    hitboxHeight: 500,
    logoSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2c.6 2.1 2.6 3.6 2.6 6.2 0 1.6-.8 2.8-2 3.6 2.6.4 4.6 2.6 4.6 5.4 0 3.2-2.6 5.8-5.8 5.8-3.2 0-5.8-2.6-5.8-5.8 0-1.8.8-3.4 2.2-4.4-.6-.8-1-1.8-1-3C6.8 6.4 9.2 4.4 12 2Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    slug: "solana-hackathon",
    name: "Colosseum Hackathon",
    tagline: "Superteam Brasil x Solana",
    description:
      "Colosseum Global Hackathon 2026. Build on Solana, compete globally, win R$5M+ in prizes and seed capital. Brazilian teams already won $300K last edition.",
    url: "https://colosseum.com/frontier?ref=brasil",
    accent: "#9945FF",
    gridX: 1,
    gridZ: 1,
    features: ["R$5M+ in prizes", "$300K seed per team", "80K+ global builders"],
    Building: SolanaHackathonBuilding,
    hitboxRadius: 80,
    hitboxHeight: 500,
    logoSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16l-2 2H6L4 7Z" fill="currentColor" />
        <path d="M4 17h16l-2-2H6l-2 2Z" fill="currentColor" />
        <path d="M20 12H4l2-2h12l2 2Z" fill="currentColor" />
      </svg>
    ),
  },
];
