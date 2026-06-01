"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import TowerBuilding from "@/lib/sponsors/buildings/TowerBuilding";
import { CUSTOM_COMPONENTS } from "@/lib/landmarks/component-registry";
import { isCustomComponentName } from "@/lib/landmarks/custom-component-names";
import type { TemplateConfig } from "@/lib/landmarks/types";

// Midnight theme defaults (matches theme[0] from CityCanvas).
const PREVIEW_WINDOW_LIT = ["#a0c0f0", "#80a0e0", "#6080c8", "#c0d8f8", "#e0e8ff"];
const PREVIEW_FACE = "#101828";

export interface LivePreviewProps {
  /** Card + shell */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  features: string[];
  accent: string;
  /** Geometry */
  buildingKind: "tower" | "custom";
  customComponent: string;
  templateConfig: TemplateConfig | null;
  hitboxRadius: number;
  hitboxHeight: number;
}

function getMissingReason(p: LivePreviewProps): string | null {
  if (p.buildingKind === "custom") {
    if (!p.customComponent) return "No custom component selected";
    if (!isCustomComponentName(p.customComponent)) return `Unknown custom component: ${p.customComponent}`;
    return null;
  }
  if (!p.templateConfig) return "No template config";
  if (!p.templateConfig.pixel_text && !p.templateConfig.facade_bitmap) {
    return "Pick pixel text or a facade bitmap";
  }
  return null;
}

export function LivePreview(props: LivePreviewProps) {
  const missing = getMissingReason(props);
  const [cardOpen, setCardOpen] = useState(false);

  return (
    <div className="relative h-[640px] w-full overflow-hidden border-[3px] border-border bg-black">
      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        camera={{ position: [520, 420, 620], fov: 35, near: 1, far: 4000 }}
        style={{ background: "#0a1428" }}
      >
        <color attach="background" args={["#0a1428"]} />
        <fog attach="fog" args={["#0a1428", 900, 2400]} />
        <ambientLight intensity={0.5} color="#4060b0" />
        <hemisphereLight args={["#5080a0", "#202830", 0.5]} />
        <directionalLight position={[300, 400, -200]} intensity={0.8} color="#7090d0" />
        <directionalLight position={[-200, 200, 200]} intensity={0.3} color="#304080" />

        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color="#242c38" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#344050" transparent opacity={0.35} />
        </mesh>

        <Suspense fallback={null}>
          <PreviewBuilding {...props} onClick={() => setCardOpen(true)} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={400}
          maxDistance={1600}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 - 0.05}
          autoRotate
          autoRotateSpeed={0.5}
          target={[0, 200, 0]}
        />
      </Canvas>

      {missing && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 border border-red-800/60 bg-black/80 px-3 py-1.5 text-[10px] text-red-400 backdrop-blur-sm">
          {missing}
        </div>
      )}

      {/* Preview card overlay (centered inside preview) */}
      {cardOpen && !missing && (
        <PreviewCard
          name={props.name}
          tagline={props.tagline}
          description={props.description}
          features={props.features.filter(Boolean)}
          url={props.url}
          accent={props.accent}
          onClose={() => setCardOpen(false)}
        />
      )}

      {/* Controls bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 text-[10px]">
        <span className="pointer-events-none text-dim">
          drag to rotate · scroll to zoom · click building to open card
        </span>
        <button
          onClick={() => setCardOpen((v) => !v)}
          className="pointer-events-auto cursor-pointer border border-border bg-bg/80 px-3 py-1.5 text-muted backdrop-blur-sm transition-colors hover:border-border-light hover:text-cream"
          disabled={!!missing}
        >
          {cardOpen ? "HIDE CARD" : "SHOW CARD"}
        </button>
      </div>
    </div>
  );
}

function PreviewBuilding({
  accent,
  buildingKind,
  customComponent,
  templateConfig,
  hitboxRadius,
  hitboxHeight,
  onClick,
}: LivePreviewProps & { onClick: () => void }) {
  // Theme accent = landmark accent so the color picker always affects preview.
  // In the real city, accent_source='theme' rotates with the city; here we
  // show the landmark's chosen color as a stand-in for the "adapted" color.
  const themeAccent = accent;

  const rendered = useMemo(() => {
    if (buildingKind === "custom") {
      if (!customComponent || !isCustomComponentName(customComponent)) {
        return <MissingBuilding />;
      }
      const Component = CUSTOM_COMPONENTS[customComponent];
      return (
        <Component
          themeAccent={themeAccent}
          themeWindowLit={PREVIEW_WINDOW_LIT}
          themeFace={PREVIEW_FACE}
        />
      );
    }

    if (!templateConfig) return <MissingBuilding />;
    const hasContent = !!(templateConfig.pixel_text || templateConfig.facade_bitmap);
    if (!hasContent) return <MissingBuilding />;

    return (
      <TowerBuilding
        themeAccent={themeAccent}
        themeWindowLit={PREVIEW_WINDOW_LIT}
        themeFace={PREVIEW_FACE}
        accent={accent}
        template={templateConfig}
      />
    );
  }, [accent, themeAccent, buildingKind, customComponent, templateConfig]);

  return (
    <group>
      {rendered}
      {/* Invisible hitbox cylinder — wraps the building so clicks open the card */}
      <mesh
        position={[0, hitboxHeight / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <cylinderGeometry args={[hitboxRadius, hitboxRadius, hitboxHeight, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MissingBuilding() {
  return (
    <group>
      <mesh position={[0, 100, 0]}>
        <boxGeometry args={[40, 200, 40]} />
        <meshStandardMaterial
          color="#2a3858"
          emissive="#2a3858"
          emissiveIntensity={0.3}
          wireframe
        />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[60, 2, 60]} />
        <meshStandardMaterial color="#344050" />
      </mesh>
    </group>
  );
}

// ─── Preview card (inline clone of SponsoredCard, no tracking) ──

interface PreviewCardProps {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  url: string;
  accent: string;
  onClose: () => void;
}

function PreviewCard({
  name, tagline, description, features, url, accent, onClose,
}: PreviewCardProps) {
  const ctaHostname = (() => {
    try { return new URL(url).hostname; }
    catch { return "example.com"; }
  })();

  return (
    <div className="pointer-events-auto absolute left-1/2 top-1/2 z-10 w-[320px] max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2">
      <div className="relative border-[3px] border-border bg-bg-raised/95 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="absolute right-3 top-2 z-10 text-[10px] text-muted transition-colors hover:text-cream"
        >
          ESC
        </button>

        <div className="px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2"
              style={{ borderColor: accent, backgroundColor: accent + "11", color: accent }}
            >
              <span className="text-sm font-bold">{(name[0] ?? "?").toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: accent }}>
                {name || "Untitled"}
              </p>
              <p className="text-[10px] text-muted">{tagline || "Tagline"}</p>
            </div>
          </div>
        </div>

        <div className="mx-4 h-px bg-border" />

        <div className="space-y-2 px-4 py-3">
          <p className="text-[10px] leading-relaxed text-muted">
            {description || "Description will appear here."}
          </p>

          <div className="space-y-1">
            {features.length === 0 && (
              <div className="text-[9px] text-dim">— no features yet</div>
            )}
            {features.map((feat, i) => (
              <div key={`${i}-${feat}`} className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
                <span className="text-[9px] text-muted">{feat}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            <span className="text-[9px]" style={{ color: accent + "99" }}>
              Sponsored landmark
            </span>
          </div>
        </div>

        <div className="mx-4 h-px bg-border" />

        <div className="px-4 py-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full border-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all hover:brightness-110"
            style={{ borderColor: accent, color: accent, backgroundColor: accent + "11" }}
          >
            Visit {ctaHostname}
          </a>
          <p className="mt-2 text-center text-[9px] text-dim">PREVIEW · no tracking fires</p>
        </div>
      </div>
    </div>
  );
}
