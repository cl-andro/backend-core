"use client";

import type { ComponentType } from "react";
import type { SponsorBuildingProps } from "@/lib/sponsors/registry";
import type { CustomComponentName } from "./custom-component-names";

const StubBuilding: ComponentType<SponsorBuildingProps> = () => null;

export const CUSTOM_COMPONENTS: Record<
  CustomComponentName,
  ComponentType<SponsorBuildingProps>
> = {
  firecrawl: StubBuilding,
  guaracloud: StubBuilding,
  "solana-hackathon": StubBuilding,
  ultracontext: StubBuilding,
};
