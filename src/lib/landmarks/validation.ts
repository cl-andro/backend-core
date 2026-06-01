import { PIXEL_FONT_CHARSET } from "@/lib/sponsors/pixel-font";
import { ORNAMENT_NAMES } from "@/lib/sponsors/ornaments";
import { FACADE_BITMAP_NAMES } from "@/lib/sponsors/facades";
import type { BuildingKind, TemplateConfig } from "./types";

export interface ValidatedInput {
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
}

type Err = { error: string };
type Ok<T> = { data: T };

const SLUG_RE = /^[a-z0-9-]{2,40}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const GH_LOGIN_RE = /^[a-zA-Z0-9-]{1,39}$/;
const PIXEL_TEXT_LINE_RE = /^[A-Z0-9 \-.?!]{1,8}$/;

export function validateLandmarkInput(
  body: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {},
): Ok<Partial<ValidatedInput>> | Err {
  const out: Partial<ValidatedInput> = {};

  // slug
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string" || !SLUG_RE.test(body.slug)) {
      return { error: "Invalid slug (lowercase, a-z0-9-, 2-40 chars)" };
    }
    out.slug = body.slug;
  } else if (!partial) return { error: "slug is required" };

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.length < 1 || body.name.length > 40) {
      return { error: "Invalid name (1-40 chars)" };
    }
    out.name = body.name;
  } else if (!partial) return { error: "name is required" };

  if (body.tagline !== undefined) {
    if (typeof body.tagline !== "string" || body.tagline.length < 1 || body.tagline.length > 60) {
      return { error: "Invalid tagline (1-60 chars)" };
    }
    out.tagline = body.tagline;
  } else if (!partial) return { error: "tagline is required" };

  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length < 10 || body.description.length > 240) {
      return { error: "Invalid description (10-240 chars)" };
    }
    out.description = body.description;
  } else if (!partial) return { error: "description is required" };

  if (body.url !== undefined) {
    if (typeof body.url !== "string" || body.url.length > 256 || !/^https?:\/\//.test(body.url)) {
      return { error: "Invalid URL (must start with http/https, max 256 chars)" };
    }
    out.url = body.url;
  } else if (!partial) return { error: "url is required" };

  if (body.features !== undefined) {
    if (!Array.isArray(body.features) || body.features.length > 3) {
      return { error: "features must be array of up to 3 strings" };
    }
    for (const f of body.features) {
      if (typeof f !== "string" || f.length < 1 || f.length > 40) {
        return { error: "each feature must be 1-40 chars" };
      }
    }
    out.features = body.features;
  } else if (!partial) out.features = [];

  if (body.accent !== undefined) {
    if (typeof body.accent !== "string" || !HEX_RE.test(body.accent)) {
      return { error: "Invalid accent (must be #RRGGBB)" };
    }
    out.accent = body.accent;
  } else if (!partial) return { error: "accent is required" };

  if (body.hitboxRadius !== undefined) {
    const v = Number(body.hitboxRadius);
    if (!Number.isFinite(v) || v < 40 || v > 200) {
      return { error: "hitboxRadius must be 40-200" };
    }
    out.hitboxRadius = v;
  }

  if (body.hitboxHeight !== undefined) {
    const v = Number(body.hitboxHeight);
    if (!Number.isFinite(v) || v < 100 || v > 800) {
      return { error: "hitboxHeight must be 100-800" };
    }
    out.hitboxHeight = v;
  }

  if (body.buildingKind !== undefined) {
    if (body.buildingKind !== "tower" && body.buildingKind !== "custom") {
      return { error: "buildingKind must be 'tower' or 'custom'" };
    }
    out.buildingKind = body.buildingKind;
  } else if (!partial) out.buildingKind = "tower";

  if (body.customComponent !== undefined) {
    if (body.customComponent !== null && typeof body.customComponent !== "string") {
      return { error: "customComponent must be string or null" };
    }
    out.customComponent = body.customComponent as string | null;
  }

  if (body.templateConfig !== undefined) {
    if (body.templateConfig === null) {
      out.templateConfig = null;
    } else {
      const tc = body.templateConfig as Record<string, unknown>;
      if (tc.roof_ornament !== undefined && !ORNAMENT_NAMES.includes(tc.roof_ornament as never)) {
        return { error: `roof_ornament must be one of: ${ORNAMENT_NAMES.join(", ")}` };
      }
      if (tc.accent_source !== "theme" && tc.accent_source !== "locked") {
        return { error: "accent_source must be 'theme' or 'locked'" };
      }
      if (tc.pixel_text && tc.facade_bitmap) {
        return { error: "provide pixel_text OR facade_bitmap, not both" };
      }
      if (tc.pixel_text) {
        if (typeof tc.pixel_text !== "string") return { error: "pixel_text must be string" };
        const lines = tc.pixel_text.split("\n");
        if (lines.length > 2) return { error: "pixel_text supports at most 2 lines" };
        for (const line of lines) {
          if (!PIXEL_TEXT_LINE_RE.test(line)) {
            return { error: "pixel_text lines must match ^[A-Z0-9 \\-.?!]{1,8}$" };
          }
        }
        if (!PIXEL_FONT_CHARSET.test(tc.pixel_text.replace(/\n/g, ""))) {
          return { error: "pixel_text contains unsupported characters" };
        }
      }
      if (tc.facade_bitmap && !FACADE_BITMAP_NAMES.includes(tc.facade_bitmap as string)) {
        return { error: `facade_bitmap must be one of: ${FACADE_BITMAP_NAMES.join(", ")}` };
      }
      out.templateConfig = {
        pixel_text: tc.pixel_text as string | undefined,
        facade_bitmap: tc.facade_bitmap as string | undefined,
        roof_ornament: (tc.roof_ornament ?? "none") as TemplateConfig["roof_ornament"],
        accent_source: tc.accent_source as TemplateConfig["accent_source"],
      };
    }
  }

  if (body.priority !== undefined) {
    const v = Number(body.priority);
    if (!Number.isFinite(v) || v < 0 || v > 1000) {
      return { error: "priority must be 0-1000" };
    }
    out.priority = v;
  }

  if (body.ownerGithubLogins !== undefined) {
    if (!Array.isArray(body.ownerGithubLogins) || body.ownerGithubLogins.length > 5) {
      return { error: "ownerGithubLogins must be array of up to 5 entries" };
    }
    const normalized: string[] = [];
    for (const l of body.ownerGithubLogins) {
      if (typeof l !== "string" || !GH_LOGIN_RE.test(l)) {
        return { error: `Invalid GitHub login: ${String(l)}` };
      }
      normalized.push(l.toLowerCase());
    }
    out.ownerGithubLogins = normalized;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return { error: "active must be boolean" };
    out.active = body.active;
  }

  // Cross-field: kind / config consistency
  const effectiveKind = out.buildingKind;
  if (effectiveKind === "tower" && out.templateConfig === null) {
    return { error: "tower kind requires templateConfig" };
  }
  if (effectiveKind === "custom" && !out.customComponent) {
    return { error: "custom kind requires customComponent" };
  }

  return { data: out };
}
