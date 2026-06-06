"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WallpaperPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-[#060814] overflow-hidden flex flex-col items-center justify-center font-mono">
      {/* Animated 3D Grid background in CSS */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{
          backgroundImage: `
            linear-gradient(to right, #c8e64a 1px, transparent 1px),
            linear-gradient(to bottom, #c8e64a 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          transform: "perspective(500px) rotateX(60deg) translateY(-50px)",
          transformOrigin: "top center",
          animation: "grid-drift 20s linear infinite"
        }}
      />

      <style>{`
        @keyframes grid-drift {
          0% { background-position: 0 0; }
          100% { background-position: 0 800px; }
        }
      `}</style>

      {/* Cyberpunk ambient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#060814] via-transparent to-transparent pointer-events-none" />

      {/* Futuristic status hub */}
      <div className="relative z-10 border-[3px] border-border bg-[#0d0f22]/90 p-8 text-center max-w-md shadow-2xl backdrop-blur-md">
        <div className="h-2 w-2 rounded-full bg-lime animate-ping absolute top-4 right-4" />
        
        <h1 className="text-lime text-lg font-bold tracking-widest uppercase">
          GITSOCIAL WALLPAPER
        </h1>
        <p className="text-[10px] text-muted mt-2 uppercase tracking-wider">
          System rotation · 2D lightweight mode active
        </p>

        <div className="my-6 border-y border-dashed border-border py-4 text-left text-[10px] space-y-2 text-gray-400">
          <div>[STATUS] Live wallpaper canvas disabled</div>
          <div>[INFO] Resource usage optimized for mobile webviews</div>
          <div>[THEME] Midnight Green Active</div>
        </div>

        <Link
          href="/"
          className="inline-block border-2 border-lime text-lime px-6 py-2 text-[10px] uppercase font-bold tracking-wider hover:bg-lime hover:text-black transition-all"
        >
          Return to Feed
        </Link>
      </div>
    </div>
  );
}