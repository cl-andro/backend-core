import { LandmarkForm } from "../_components/form";
import { ORNAMENT_NAMES } from "@/lib/sponsors/ornaments";
import { FACADE_BITMAP_NAMES } from "@/lib/sponsors/facades";
import { CUSTOM_COMPONENT_NAMES } from "@/lib/landmarks/custom-component-names";

export default function NewLandmarkPage() {
  return (
    <LandmarkForm
      mode="create"
      ornamentNames={ORNAMENT_NAMES}
      facadeBitmapNames={FACADE_BITMAP_NAMES}
      customComponentNames={CUSTOM_COMPONENT_NAMES}
    />
  );
}
