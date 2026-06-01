"use client";

import type { ComponentType } from "react";
import type { SponsorBuildingProps, SponsorConfig } from "@/lib/sponsors/registry";
import TowerBuilding from "@/lib/sponsors/buildings/TowerBuilding";
import { CUSTOM_COMPONENTS } from "./component-registry";
import { isCustomComponentName } from "./custom-component-names";
import type { Assignment, Landmark } from "./types";

/**
 * A resolved sponsor = a landmark DB row + a physical slot + a Building
 * component ready to receive theme props. This is the shape
 * `<SponsoredLandmark>` has always consumed.
 */
export interface ResolvedSponsor extends SponsorConfig {
  /** Landmark ID (for tracking) */
  landmarkId: string;
}

/**
 * Wrap TowerBuilding so it captures the landmark-specific accent + template.
 * The returned component has the stable `SponsorBuildingProps` signature
 * that `<SponsoredLandmark>` expects.
 */
function buildTowerComponent(landmark: Landmark): ComponentType<SponsorBuildingProps> {
  const { templateConfig, accent } = landmark;
  if (!templateConfig) {
    throw new Error(`Landmark ${landmark.slug} is 'tower' but has no template_config`);
  }

  function Wrapped(props: SponsorBuildingProps) {
    return (
      <TowerBuilding
        {...props}
        accent={accent}
        template={templateConfig!}
      />
    );
  }
  Wrapped.displayName = `Tower(${landmark.slug})`;
  return Wrapped;
}

/**
 * Translate server-computed assignments into the shape CityCanvas consumes.
 * Slots without a matching landmark are skipped.
 */
export function resolveAssignmentsToSponsors(
  assignments: readonly Assignment[],
): ResolvedSponsor[] {
  const out: ResolvedSponsor[] = [];

  for (const { slot, landmark } of assignments) {
    let Building: ComponentType<SponsorBuildingProps> | undefined;

    if (landmark.buildingKind === "custom") {
      if (!landmark.customComponent) continue;
      if (!isCustomComponentName(landmark.customComponent)) {
        console.warn(`[landmarks] unknown custom_component: ${landmark.customComponent}`);
        continue;
      }
      Building = CUSTOM_COMPONENTS[landmark.customComponent];
    } else {
      Building = buildTowerComponent(landmark);
    }

    out.push({
      slug: landmark.slug,
      name: landmark.name,
      tagline: landmark.tagline,
      description: landmark.description,
      url: landmark.url,
      accent: landmark.accent,
      gridX: slot.gridX,
      gridZ: slot.gridZ,
      features: landmark.features,
      Building,
      hitboxRadius: landmark.hitboxRadius,
      hitboxHeight: landmark.hitboxHeight,
      landmarkId: landmark.id,
    });
  }

  return out;
}
