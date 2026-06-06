"use client";

interface AdPreviewProps {
  vehicle: "plane" | "blimp" | "billboard" | "landmark" | string | null;
  text: string;
  color: string;
  bgColor: string;
  tall?: boolean;
}

export default function AdPreview({ vehicle, text, color, bgColor, tall }: AdPreviewProps) {
  const isSky = vehicle === "plane" || vehicle === "blimp";
  const textColor = color.startsWith("#") ? color : `#${color}`;
  const backgroundColor = bgColor.startsWith("#") ? bgColor : `#${bgColor}`;

  return (
    <div className={`relative w-full ${tall ? 'h-[480px]' : 'h-[360px]'} overflow-hidden border-[3px] border-border bg-[#05070e] font-mono flex flex-col justify-between p-4`}>
      {/* Scanline overlay for retro look */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />
      
      {/* Background stars / grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
        backgroundSize: "24px 24px"
      }} />

      {/* Header Info */}
      <div className="relative z-10 flex justify-between items-center text-[10px] text-muted">
        <span className="text-lime font-bold uppercase tracking-wider">
          AD FORMAT PREVIEW (2D LIGHTWEIGHT)
        </span>
        <span className="px-1.5 py-0.5 border border-border bg-[#0d0f22] capitalize">
          {vehicle || "Billboard"} format
        </span>
      </div>

      {/* Main Preview Screen */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {isSky ? (
          /* Sky format: Plane / Blimp banner */
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 animate-bounce duration-2000">
              {/* Aircraft Icon placeholder (CSS) */}
              <div className="w-16 h-8 bg-lime/10 border-2 border-lime flex items-center justify-center text-[10px] text-lime font-bold rounded-lg relative shrink-0">
                {vehicle?.toUpperCase()}
                {/* Propeller or tail */}
                <div className="absolute -left-1 top-2 w-1 h-4 bg-lime" />
                <div className="absolute -right-2 top-3 w-2.5 h-1.5 bg-lime" />
              </div>

              {/* Tow rope */}
              <div className="w-8 h-[2px] bg-dashed border-t-2 border-dashed border-lime/50" />

              {/* Tow banner */}
              <div 
                className="flex-1 border-[3px] p-3 text-center rounded font-bold uppercase select-none transition-all shadow-lg min-h-[50px] flex items-center justify-center text-xs"
                style={{ 
                  color: textColor, 
                  backgroundColor: backgroundColor,
                  borderColor: textColor,
                  boxShadow: `0 0 10px ${textColor}33`
                }}
              >
                {text || "YOUR BRAND HERE"}
              </div>
            </div>
            <span className="text-[9px] text-dim">
              * Flies across the sky above active developer feeds
            </span>
          </div>
        ) : (
          /* Building billboard format */
          <div className="w-full max-w-xs flex flex-col items-center">
            {/* Billboard screen */}
            <div 
              className="w-full border-[3px] p-4 text-center rounded-lg font-bold uppercase select-none transition-all shadow-2xl min-h-[80px] flex items-center justify-center text-sm"
              style={{ 
                color: textColor, 
                backgroundColor: backgroundColor,
                borderColor: textColor,
                boxShadow: `0 0 15px ${textColor}44`
              }}
            >
              {text || "YOUR BRAND HERE"}
            </div>

            {/* Billboard stand */}
            <div className="w-4 h-12 bg-[#1f2937] border-x-2 border-[#374151]" />
            <div className="w-16 h-2 bg-[#374151] rounded" />

            {/* Building base outline */}
            <div className="w-44 h-16 border-t-2 border-x-2 border-[#1f2937] bg-[#111827]/50 mt-1 flex flex-col justify-end p-2">
              {/* Fake windows */}
              <div className="grid grid-cols-4 gap-1.5 opacity-30">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-2 bg-yellow-500/50 rounded-sm" />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="relative z-10 flex justify-between items-center text-[9px] text-dim border-t border-border/20 pt-2">
        <span>TEXT COLOR: {textColor}</span>
        <span>BG COLOR: {backgroundColor}</span>
      </div>
    </div>
  );
}
