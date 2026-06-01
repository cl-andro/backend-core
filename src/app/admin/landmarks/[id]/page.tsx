import { notFound } from "next/navigation";
import { getById } from "@/lib/landmarks/repository";
import { LandmarkForm } from "../_components/form";
import { ORNAMENT_NAMES } from "@/lib/sponsors/ornaments";
import { FACADE_BITMAP_NAMES } from "@/lib/sponsors/facades";
import { CUSTOM_COMPONENT_NAMES } from "@/lib/landmarks/custom-component-names";

export const dynamic = "force-dynamic";

export default async function EditLandmarkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const landmark = await getById(id);
  if (!landmark) notFound();

  return (
    <LandmarkForm
      mode="edit"
      initial={landmark}
      ornamentNames={ORNAMENT_NAMES}
      facadeBitmapNames={FACADE_BITMAP_NAMES}
      customComponentNames={CUSTOM_COMPONENT_NAMES}
    />
  );
}
