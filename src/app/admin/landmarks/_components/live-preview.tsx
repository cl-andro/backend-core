"use client";

import { useState } from "react";

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
  templateConfig: any | null;
  hitboxRadius: number;
  hitboxHeight: number;
}

function getMissingReason(p: LivePreviewProps): string | null {
  if (p.buildingKind === "custom") {
    if (!p.customComponent) return "No custom component selected";
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
  const [cardOpen, setCardOpen] = useState(true);

  // Parse color nicely
  const accentColor = props.accent.startsWith("#") ? props.accent : `#${props.accent}`;

  return (
    <div className="relative h-[640px] w-full overflow-hidden border-[3px] border-border bg-[#0a1428] font-mono flex flex-col justify-between p-4">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px), linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
        backgroundSize: "20px 20px, 40px 40px, 40px 40px"
      }} />

      {/* Header Info */}
      <div className="relative z-10 flex justify-between items-start">
        <span className="text-[10px] text-lime font-bold tracking-wider">
          LIVE PREVIEW (2D STATIC MODE)
        </span>
        {missing && (
          <span className="border border-red-500/50 bg-red-950/80 px-2 py-0.5 text-[10px] text-red-400">
            {missing}
          </span>
        )}
      </div>

      {/* Visual Building Mockup */}
      <div className="relative z-10 flex-1 flex items-center justify-center gap-8 py-4">
        {/* 2D Building Representation */}
        {!missing && (
          <div className="flex flex-col items-center select-none animate-pulse duration-3000">
            {/* Hologram Peak */}
            <div 
              className="w-1.5 h-12 transition-all duration-300"
              style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}` }}
            />
            {/* Building facade wrapper */}
            <div 
              className="w-40 border-[3px] flex flex-col justify-between p-3 relative bg-[#101828]/90 transition-all duration-300"
              style={{ 
                borderColor: accentColor, 
                height: `${Math.min(300, Math.max(160, props.hitboxHeight / 1.8))}px`,
                boxShadow: `0 0 20px ${accentColor}33`
              }}
            >
              {/* Decorative Window Array */}
              <div className="grid grid-cols-4 gap-2 opacity-80">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="h-3 rounded-sm transition-all"
                    style={{ 
                      backgroundColor: (i % 3 === 0) ? accentColor : "#1f2937",
                      boxShadow: (i % 3 === 0) ? `0 0 5px ${accentColor}` : "none"
                    }}
                  />
                ))}
              </div>

              {/* Landmark text / type details */}
              <div className="mt-auto border-t border-dashed border-gray-700 pt-2 text-[9px] text-gray-400">
                <div>KIND: {props.buildingKind.toUpperCase()}</div>
                {props.buildingKind === "custom" ? (
                  <div className="truncate text-lime">COMP: {props.customComponent}</div>
                ) : (
                  <>
                    <div className="truncate">TEXT: "{props.templateConfig?.pixel_text || 'None'}"</div>
                    <div className="truncate">BITMAP: {props.templateConfig?.facade_bitmap || 'None'}</div>
                    <div>ROOF: {props.templateConfig?.roof_ornament || 'None'}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card preview beside the building */}
        {cardOpen && !missing && (
          <div className="w-[300px] border-[3px] border-border bg-[#101828]/95 p-4 text-left shadow-2xl relative select-none">
            <button
              onClick={() => setCardOpen(false)}
              className="absolute right-3 top-2 text-[10px] text-muted hover:text-cream"
            >
              [X]
            </button>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 font-bold text-sm"
                style={{ borderColor: accentColor, backgroundColor: `${accentColor}22`, color: accentColor }}
              >
                {(props.name[0] ?? "?").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate" style={{ color: accentColor }}>
                  {props.name || "Untitled"}
                </p>
                <p className="text-[9px] text-muted truncate">{props.tagline || "Tagline"}</p>
              </div>
            </div>

            <div className="my-3 h-[1px] bg-border/50" />

            <div className="space-y-2">
              <p className="text-[10px] leading-relaxed text-muted line-clamp-3">
                {props.description || "Description will appear here."}
              </p>

              <div className="space-y-1">
                {props.features.filter(Boolean).length === 0 && (
                  <div className="text-[9px] text-dim">— no features yet</div>
                )}
                {props.features.filter(Boolean).map((feat, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[9px] text-muted">
                    <div className="h-1 w-1 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="my-3 h-[1px] bg-border/50" />

            <a
              href={props.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full border-2 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider"
              style={{ borderColor: accentColor, color: accentColor, backgroundColor: `${accentColor}11` }}
            >
              Visit URL
            </a>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="relative z-10 flex justify-between items-center text-[9px] text-muted border-t border-border/30 pt-2">
        <span>RADIUS: {props.hitboxRadius}px · HEIGHT: {props.hitboxHeight}px</span>
        <button
          onClick={() => setCardOpen((v) => !v)}
          className="border border-border bg-bg/85 px-2 py-1 text-muted hover:border-border-light hover:text-cream cursor-pointer"
          disabled={!!missing}
        >
          {cardOpen ? "HIDE CARD" : "SHOW CARD"}
        </button>
      </div>
    </div>
  );
}
