import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import type {
  BuildingKind,
  Landmark,
  TemplateConfig,
} from "./types";

interface LandmarkRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  features: unknown;
  accent: string;
  hitbox_radius: number;
  hitbox_height: number;
  building_kind: BuildingKind;
  custom_component: string | null;
  template_config: TemplateConfig | null;
  priority: number;
  owner_github_logins: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToLandmark(r: LandmarkRow): Landmark {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    url: r.url,
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
    accent: r.accent,
    hitboxRadius: r.hitbox_radius,
    hitboxHeight: r.hitbox_height,
    buildingKind: r.building_kind,
    customComponent: r.custom_component,
    templateConfig: r.template_config,
    priority: r.priority,
    ownerGithubLogins: r.owner_github_logins,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface LandmarkInput {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  features: string[];
  accent: string;
  hitboxRadius?: number;
  hitboxHeight?: number;
  buildingKind: BuildingKind;
  customComponent?: string | null;
  templateConfig?: TemplateConfig | null;
  priority?: number;
  ownerGithubLogins?: string[];
  active?: boolean;
}

function inputToRow(input: LandmarkInput): Record<string, unknown> {
  return {
    slug: input.slug,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    url: input.url,
    features: input.features,
    accent: input.accent,
    hitbox_radius: input.hitboxRadius ?? 80,
    hitbox_height: input.hitboxHeight ?? 500,
    building_kind: input.buildingKind,
    custom_component: input.customComponent ?? null,
    template_config: input.templateConfig ?? null,
    priority: input.priority ?? 100,
    owner_github_logins: input.ownerGithubLogins ?? [],
    active: input.active ?? true,
  };
}

/**
 * Server-only: active pool for rendering. Uses anon session for
 * RLS-safe reads (public policy allows active=true).
 */
export async function getActivePool(): Promise<Landmark[]> {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("landmarks")
    .select("*")
    .eq("active", true)
    .order("priority", { ascending: false });
  if (error) {
    console.error("[landmarks] getActivePool failed", error);
    return [];
  }
  return (data as LandmarkRow[]).map(rowToLandmark);
}

/** Admin: fetch all rows, including inactive. */
export async function listAll(): Promise<Landmark[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("landmarks")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as LandmarkRow[]).map(rowToLandmark);
}

export async function getById(id: string): Promise<Landmark | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("landmarks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLandmark(data as LandmarkRow) : null;
}

export async function getBySlug(slug: string): Promise<Landmark | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("landmarks")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLandmark(data as LandmarkRow) : null;
}

export async function createLandmark(input: LandmarkInput): Promise<Landmark> {
  const { data, error } = await getSupabaseAdmin()
    .from("landmarks")
    .insert(inputToRow(input))
    .select("*")
    .single();
  if (error) throw error;
  return rowToLandmark(data as LandmarkRow);
}

export async function updateLandmark(
  id: string,
  patch: Partial<LandmarkInput>,
): Promise<Landmark> {
  const row: Record<string, unknown> = {};
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.tagline !== undefined) row.tagline = patch.tagline;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.features !== undefined) row.features = patch.features;
  if (patch.accent !== undefined) row.accent = patch.accent;
  if (patch.hitboxRadius !== undefined) row.hitbox_radius = patch.hitboxRadius;
  if (patch.hitboxHeight !== undefined) row.hitbox_height = patch.hitboxHeight;
  if (patch.buildingKind !== undefined) row.building_kind = patch.buildingKind;
  if (patch.customComponent !== undefined) row.custom_component = patch.customComponent;
  if (patch.templateConfig !== undefined) row.template_config = patch.templateConfig;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.ownerGithubLogins !== undefined) row.owner_github_logins = patch.ownerGithubLogins;
  if (patch.active !== undefined) row.active = patch.active;

  const { data, error } = await getSupabaseAdmin()
    .from("landmarks")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return rowToLandmark(data as LandmarkRow);
}

/** Soft-delete via active=false. */
export async function setActive(id: string, active: boolean): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("landmarks")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}

export async function hardDelete(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("landmarks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
