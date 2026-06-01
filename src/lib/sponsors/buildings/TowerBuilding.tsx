"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SponsorBuildingProps } from "../registry";
import type { TemplateConfig, OrnamentName } from "@/lib/landmarks/types";
import { makeBitmap, PF_HEIGHT } from "../pixel-font";
import { createGlassTex } from "../glass-texture";
import { ORNAMENTS } from "../ornaments";
import { FACADE_BITMAPS } from "../facades";

// ─── Tower geometry — matches the shared 3-section silhouette ──
const BW = 105, BD = 58, BH = 125;
const MW = 92, MD = 52, MH = 125;
const TW = 72, TD = 45, TH = 95;

interface TowerBuildingProps extends SponsorBuildingProps {
  /** Landmark-specific accent (used verbatim when accent_source='locked'). */
  accent: string;
  template: TemplateConfig;
}

function CornerStrips({ w, d, h, yC, accent }: {
  w: number; h: number; d: number; yC: number; accent: string;
}) {
  const hw = w / 2, hd = d / 2;
  return (
    <>
      {[[hw, hd], [hw, -hd], [-hw, hd], [-hw, -hd]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, yC, cz]}>
          <boxGeometry args={[0.6, h, 0.6]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function GlassFacade({ tex, w, h, pos, rotY, emColor }: {
  tex: THREE.Texture;
  w: number; h: number;
  pos: [number, number, number];
  rotY: number;
  emColor: string;
}) {
  return (
    <mesh position={pos} rotation={[0, rotY, 0]}>
      <planeGeometry args={[w - 4, h - 4]} />
      <meshStandardMaterial
        map={tex}
        emissive={emColor}
        emissiveMap={tex}
        emissiveIntensity={0.7}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

function BoxSection({ w, h, d, y, shellMat, glassFront, glassSide, emColor, accent }: {
  w: number; h: number; d: number; y: number;
  shellMat: THREE.Material;
  glassFront: THREE.Texture;
  glassSide: THREE.Texture;
  emColor: string;
  accent: string;
}) {
  return (
    <group>
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[w, h, d]} />
        <primitive object={shellMat} attach="material" />
      </mesh>
      <GlassFacade tex={glassFront} w={w} h={h} pos={[0, y, d / 2 + 0.3]} rotY={0} emColor={emColor} />
      <GlassFacade tex={glassFront} w={w} h={h} pos={[0, y, -d / 2 - 0.3]} rotY={Math.PI} emColor={emColor} />
      <GlassFacade tex={glassSide} w={d} h={h} pos={[w / 2 + 0.3, y, 0]} rotY={Math.PI / 2} emColor={emColor} />
      <GlassFacade tex={glassSide} w={d} h={h} pos={[-w / 2 - 0.3, y, 0]} rotY={-Math.PI / 2} emColor={emColor} />
      <CornerStrips w={w} d={d} h={h} yC={y} accent={accent} />
    </group>
  );
}

/**
 * Generic parameterized tower for dynamic landmarks.
 *
 * Reads `template_config` from the DB row and renders:
 *   - 3-section shell (base / mid / top) with corner strips + platform
 *   - Mid facade: either pixel text or a named bitmap from FACADE_BITMAPS
 *   - Roof ornament: factory looked up by name in ORNAMENTS
 *   - Accent source: `theme` uses props.themeAccent; `locked` uses props.accent
 *
 * The existing Firecrawl/Solana/Guara buildings stay as-is and are
 * registered in CUSTOM_COMPONENTS for 100% visual parity on seed data.
 * TowerBuilding handles new landmarks added via the admin UI.
 */
export default function TowerBuilding({
  themeAccent,
  themeWindowLit,
  themeFace,
  accent,
  template,
}: TowerBuildingProps) {
  const ornamentRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  const resolvedAccent = template.accent_source === "locked" ? accent : themeAccent;

  const shellColor = useMemo(() => {
    const c = new THREE.Color(themeFace);
    c.multiplyScalar(1.8);
    return "#" + c.getHexString();
  }, [themeFace]);
  const windowOff = useMemo(() => {
    const c = new THREE.Color(themeFace);
    c.multiplyScalar(0.6);
    return "#" + c.getHexString();
  }, [themeFace]);

  // ── Resolve facade bitmap (either from PF text or named FACADE_BITMAPS entry) ──
  const facade = useMemo(() => {
    if (template.facade_bitmap) {
      const entry = FACADE_BITMAPS[template.facade_bitmap];
      if (!entry) {
        console.warn(`[TowerBuilding] unknown facade_bitmap: ${template.facade_bitmap}`);
        return null;
      }
      return {
        bitmap: entry.bitmap,
        coreBitmap: entry.coreBitmap,
        coreColor: entry.coreColor,
      };
    }
    if (template.pixel_text) {
      const lines = template.pixel_text.split("\n").slice(0, 2);
      const bitmaps = lines.map(makeBitmap);
      // stack two lines with 1-row gap
      const widths = bitmaps.map(b => b[0]?.length ?? 0);
      const width = Math.max(...widths, 1);
      const height = bitmaps.length === 1 ? PF_HEIGHT : PF_HEIGHT * 2 + 1;
      const stacked = Array.from({ length: height }, () => Array(width).fill(0));
      let y = 0;
      for (const bm of bitmaps) {
        const lineW = bm[0]?.length ?? 0;
        const xOff = Math.floor((width - lineW) / 2);
        for (let r = 0; r < bm.length; r++) {
          for (let c = 0; c < lineW; c++) {
            stacked[y + r][xOff + c] = bm[r][c];
          }
        }
        y += PF_HEIGHT + 1;
      }
      return { bitmap: stacked };
    }
    return null;
  }, [template.pixel_text, template.facade_bitmap]);

  const midCols = Math.max(14, (facade?.bitmap[0]?.length ?? 0) + 4);
  const midRows = Math.max(9, (facade?.bitmap.length ?? 0) + 2);
  const bmCol = facade ? Math.floor((midCols - facade.bitmap[0].length) / 2) : 0;
  const bmRow = facade ? Math.floor((midRows - facade.bitmap.length) / 2) : 0;

  const B_Y = BH / 2 + 4;
  const M_Y = BH + 4 + MH / 2;
  const T_Y = BH + MH + 4 + TH / 2;

  const mFront = useMemo(() => createGlassTex({
    cols: midCols, rows: midRows, seed: 77,
    litColors: themeWindowLit, offColor: windowOff, faceColor: themeFace,
    accentColor: resolvedAccent,
    bitmap: facade?.bitmap, bmCol, bmRow,
    coreBitmap: facade?.coreBitmap, coreColor: facade?.coreColor,
  }), [midCols, midRows, themeWindowLit, windowOff, themeFace, resolvedAccent, facade, bmCol, bmRow]);

  const mSide = useMemo(() => createGlassTex({
    cols: 5, rows: midRows, seed: 91,
    litColors: themeWindowLit, offColor: windowOff, faceColor: themeFace,
  }), [midRows, themeWindowLit, windowOff, themeFace]);

  const bFront = useMemo(() => createGlassTex({
    cols: midCols, rows: 9, seed: 55,
    litColors: themeWindowLit, offColor: windowOff, faceColor: themeFace,
  }), [midCols, themeWindowLit, windowOff, themeFace]);
  const bSide = useMemo(() => createGlassTex({
    cols: 5, rows: 9, seed: 66,
    litColors: themeWindowLit, offColor: windowOff, faceColor: themeFace,
  }), [themeWindowLit, windowOff, themeFace]);

  const tFront = useMemo(() => createGlassTex({
    cols: midCols, rows: 7, seed: 88,
    litColors: themeWindowLit, offColor: windowOff, faceColor: themeFace,
  }), [midCols, themeWindowLit, windowOff, themeFace]);
  const tSide = useMemo(() => createGlassTex({
    cols: 4, rows: 7, seed: 99,
    litColors: themeWindowLit, offColor: windowOff, faceColor: themeFace,
  }), [themeWindowLit, windowOff, themeFace]);

  useEffect(() => () => {
    mFront.dispose();
    mSide.dispose();
    bFront.dispose();
    bSide.dispose();
    tFront.dispose();
    tSide.dispose();
  }, [mFront, mSide, bFront, bSide, tFront, tSide]);

  const shellMat = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.25, metalness: 0.8 }),
    [shellColor],
  );
  const shellMatLight = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.4, metalness: 0.5 }),
    [shellColor],
  );

  const ornamentGroup = useMemo(() => {
    const factory = ORNAMENTS[template.roof_ornament as OrnamentName] ?? ORNAMENTS.none;
    return factory(resolvedAccent);
  }, [template.roof_ornament, resolvedAccent]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ornamentRef.current) {
      ornamentRef.current.rotation.y = t * 0.3;
      ornamentRef.current.position.y = Math.sin(t * 0.8) * 2;
    }
    if (beaconRef.current) {
      beaconRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.15);
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2 + Math.sin(t * 1.5) * 0.8;
    }
  });

  const emC = themeWindowLit[0] ?? "#fff";
  const topY = BH + MH + TH + 4;
  const antennaY = topY + 25;

  return (
    <group>
      {/* Platform */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[BW + 20, 3, BD + 20]} />
        <primitive object={shellMatLight} attach="material" />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[BW + 22, 1, BD + 22]} />
        <meshStandardMaterial color={resolvedAccent} emissive={resolvedAccent} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>

      {/* Base */}
      <BoxSection w={BW} h={BH} d={BD} y={B_Y}
        shellMat={shellMat} glassFront={bFront} glassSide={bSide}
        emColor={emC} accent={resolvedAccent} />

      <mesh position={[0, BH + 4, 0]}>
        <boxGeometry args={[BW + 2, 1.5, BD + 2]} />
        <meshStandardMaterial color={resolvedAccent} emissive={resolvedAccent} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>

      {/* Mid (facade) */}
      <BoxSection w={MW} h={MH} d={MD} y={M_Y}
        shellMat={shellMat} glassFront={mFront} glassSide={mSide}
        emColor={emC} accent={resolvedAccent} />

      <mesh position={[0, BH + MH + 4, 0]}>
        <boxGeometry args={[MW + 2, 1.5, MD + 2]} />
        <meshStandardMaterial color={resolvedAccent} emissive={resolvedAccent} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>

      {/* Top */}
      <BoxSection w={TW} h={TH} d={TD} y={T_Y}
        shellMat={shellMat} glassFront={tFront} glassSide={tSide}
        emColor={emC} accent={resolvedAccent} />

      <mesh position={[0, topY, 0]}>
        <boxGeometry args={[TW + 4, 1.2, TD + 4]} />
        <meshStandardMaterial color={resolvedAccent} emissive={resolvedAccent} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      <mesh position={[0, topY + 1.5, 0]}>
        <boxGeometry args={[TW - 8, 2, TD - 8]} />
        <primitive object={shellMatLight} attach="material" />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, antennaY, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 42, 4]} />
        <meshStandardMaterial color={shellColor} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Ornament */}
      <group position={[0, antennaY + 32, 0]}>
        <group ref={ornamentRef}>
          <primitive object={ornamentGroup} />
        </group>
        <pointLight color={resolvedAccent} intensity={40} distance={110} decay={2} />
      </group>

      {/* Beacon */}
      <mesh ref={beaconRef} position={[0, antennaY + 60, 0]}>
        <sphereGeometry args={[2.5, 8, 8]} />
        <meshStandardMaterial color={resolvedAccent} emissive={resolvedAccent} emissiveIntensity={2.5} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, antennaY + 60, 0]} color={resolvedAccent} intensity={18} distance={90} decay={2} />
    </group>
  );
}
