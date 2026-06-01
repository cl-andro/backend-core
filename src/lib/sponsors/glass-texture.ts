"use client";

import * as THREE from "three";

/**
 * Shared glass facade texture generator used by sponsor buildings.
 *
 * Renders a procedural window grid with optional text/flame overlay.
 * Extracted from the per-building duplicates in Arki, Solana, Firecrawl,
 * GuaraCloud.
 */
export interface GlassTextureOptions {
  cols: number;
  rows: number;
  seed: number;
  litColors: string[];
  offColor: string;
  faceColor: string;
  /** Accent color for text/bitmap highlight pixels. */
  accentColor?: string;
  /** Optional 2D bitmap of 1/0 cells overlaid on the facade. */
  bitmap?: number[][];
  /** Column offset where the bitmap starts within the cols grid. */
  bmCol?: number;
  /** Row offset where the bitmap starts within the rows grid. */
  bmRow?: number;
  /** Optional inner-core bitmap (e.g. Firecrawl flame). Rendered in `coreColor`. */
  coreBitmap?: number[][];
  /** Color for coreBitmap pixels. */
  coreColor?: string;
  /** Extra colors to mix into lit windows (e.g. Solana gradient). */
  extraLitColors?: string[];
}

export function createGlassTex(opts: GlassTextureOptions): THREE.CanvasTexture {
  const {
    cols, rows, seed,
    litColors, offColor, faceColor,
    accentColor, bitmap, bmCol, bmRow,
    coreBitmap, coreColor,
    extraLitColors,
  } = opts;

  const cW = 16, cH = 16;
  const w = cols * cW, h = rows * cH;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const shellC = new THREE.Color(faceColor);
  shellC.multiplyScalar(1.8);
  const gridColor = "#" + shellC.getHexString();

  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cH); ctx.lineTo(w, r * cH); ctx.stroke(); }
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cW, 0); ctx.lineTo(c * cW, h); ctx.stroke(); }

  const lit = extraLitColors ? [...extraLitColors, ...litColors] : litColors;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hash = ((r * 13 + c * 23 + seed) * 2654435761) >>> 0;

      let isHighlight = false;
      let isCore = false;
      let nearHighlight = false;
      if (bitmap && bmCol != null && bmRow != null) {
        const br = r - bmRow, bc = c - bmCol;
        if (br >= 0 && br < bitmap.length && bc >= 0 && bc < bitmap[0].length) {
          if (coreBitmap && coreBitmap[br]?.[bc]) isCore = true;
          else if (bitmap[br][bc]) isHighlight = true;
        }
        if (!isHighlight && !isCore &&
            br >= -2 && br <= bitmap.length + 1 &&
            bc >= -1 && bc <= bitmap[0].length) {
          nearHighlight = true;
        }
      }

      if (isCore && coreColor) {
        ctx.fillStyle = coreColor;
        ctx.globalAlpha = 1;
        ctx.fillRect(c * cW + 1, r * cH + 1, cW - 2, cH - 2);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(c * cW - 1, r * cH - 1, cW + 2, cH + 2);
        ctx.globalAlpha = 1;
        continue;
      } else if (isHighlight && accentColor) {
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 1;
        ctx.fillRect(c * cW + 1, r * cH + 1, cW - 2, cH - 2);
        ctx.globalAlpha = 0.25;
        ctx.fillRect(c * cW - 1, r * cH - 1, cW + 2, cH + 2);
        ctx.globalAlpha = 1;
        continue;
      } else if (nearHighlight) {
        ctx.fillStyle = offColor;
        ctx.globalAlpha = 0.25;
      } else {
        const isLit = (hash % 100) < 45;
        if (isLit) {
          ctx.fillStyle = lit[hash % lit.length];
          ctx.globalAlpha = 0.45 + (hash % 20) / 100;
        } else {
          ctx.fillStyle = offColor;
          ctx.globalAlpha = 0.55;
        }
      }
      ctx.fillRect(c * cW + 2, r * cH + 2, cW - 4, cH - 4);
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}
