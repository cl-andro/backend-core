"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Download, Copy, Share2, Sparkles } from "lucide-react";

interface Props {
  githubLogin: string;
}

interface ThemePreset {
  name: string;
  accent: string;
  bg: string;
  cardBg: string;
  border: string;
}

const PRESETS: ThemePreset[] = [
  {
    name: "Neon Green",
    accent: "c8e64a",
    bg: "0d0d0f",
    cardBg: "1c1c20",
    border: "2a2a30",
  },
  {
    name: "Cyber Pink",
    accent: "ff007f",
    bg: "0f051d",
    cardBg: "1d0e34",
    border: "3d1a66",
  },
  {
    name: "Electric Blue",
    accent: "00d2ff",
    bg: "05111d",
    cardBg: "0e2234",
    border: "1a4566",
  },
  {
    name: "Sunset Gold",
    accent: "ffd700",
    bg: "1a0f00",
    cardBg: "2d1e00",
    border: "523600",
  },
  {
    name: "Retro Monochrome",
    accent: "000000",
    bg: "f0f2f5",
    cardBg: "ffffff",
    border: "dadde1",
  },
];

export default function CardCustomizerClient({ githubLogin }: Props) {
  const [format, setFormat] = useState<"landscape" | "stories">("landscape");
  const lang = "en";
  const [accent, setAccent] = useState(PRESETS[0].accent);
  const [bg, setBg] = useState(PRESETS[0].bg);
  const [cardBg, setCardBg] = useState(PRESETS[0].cardBg);
  const [border, setBorder] = useState(PRESETS[0].border);

  const [imageSrc, setImageSrc] = useState("");
  const [imageLoading, setImageLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Generate URL
  const cardUrl = `/api/share-card/${githubLogin}?format=${format}&lang=${lang}&accent=${accent}&bg=${bg}&cardBg=${cardBg}&border=${border}`;

  useEffect(() => {
    setImageLoading(true);
    // Add cache buster to trigger loading event properly
    setImageSrc(`${cardUrl}&cb=${Date.now()}`);
  }, [format, lang, accent, bg, cardBg, border, cardUrl]);

  const handleApplyPreset = (preset: ThemePreset) => {
    setAccent(preset.accent);
    setBg(preset.bg);
    setCardBg(preset.cardBg);
    setBorder(preset.border);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(cardUrl);
      if (!res.ok) throw new Error("Failed to generate card");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cluster-git.${githubLogin}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      const absoluteUrl = `${window.location.origin}${cardUrl}`;
      await navigator.clipboard.writeText(absoluteUrl);
      alert("Custom card image URL copied to clipboard!");
    } catch (e) {
      console.error(e);
    } finally {
      setCopying(false);
    }
  };

  const handleShareX = async () => {
    setSharing(true);
    try {
      const profileUrl = `${window.location.origin}/dev/${githubLogin}`;
      const tweetText = `My customized GitHub building on Cluster! Customize yours here:`;
      const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(profileUrl)}`;
      window.open(xUrl, "_blank");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6 font-sans">
      {/* LEFT COLUMN: LIVE PREVIEW */}
      <div className="lg:col-span-8 flex flex-col items-center">
        <div 
          className="relative border-4 border-black p-4 rounded-xl bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-none aspect-video flex items-center justify-center overflow-hidden transition-all duration-300"
          style={{ 
            aspectRatio: format === "landscape" ? "16/9" : "9/16",
            maxWidth: format === "landscape" ? "800px" : "420px",
          }}
        >
          {imageLoading && (
            <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-10 h-10 animate-spin text-black" />
              <span className="text-xs font-bold text-black uppercase tracking-wider">Rendering Card...</span>
            </div>
          )}
          
          {imageSrc && (
            <img
              src={imageSrc}
              alt="Cluster Social Share Card"
              className="w-full h-full object-contain rounded-md"
              style={{ imageRendering: "-webkit-optimize-contrast" }}
              onLoad={() => setImageLoading(false)}
            />
          )}
        </div>
        
        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mt-4">
          * Live rendering from GitCity graphics engine
        </p>
      </div>

      {/* RIGHT COLUMN: CONTROLS */}
      <div className="lg:col-span-4 bg-white border-4 border-black p-5 rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
        <div>
          <h2 className="text-lg font-black text-black uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Customize Card
          </h2>
          <p className="text-xs text-gray-500 font-medium">Design your custom social media preview card.</p>
        </div>

        {/* 1. Format Select */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Card Format</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setFormat("landscape")}
              className={`py-2 px-3 border-2 border-black text-xs font-bold rounded-md transition-colors ${
                format === "landscape" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              Landscape (16:9)
            </button>
            <button
              onClick={() => setFormat("stories")}
              className={`py-2 px-3 border-2 border-black text-xs font-bold rounded-md transition-colors ${
                format === "stories" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              Stories (9:16)
            </button>
          </div>
        </div>

        {/* 3. Theme Presets */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => handleApplyPreset(p)}
                className="px-2.5 py-1 text-[10px] font-extrabold border border-black rounded-md hover:bg-gray-100 transition-colors"
                style={{
                  backgroundColor: `#${p.bg}`,
                  color: `#${p.accent}`,
                  borderColor: `#${p.accent}`,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Color Pickers */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Custom Colors</label>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={`#${accent}`}
                onChange={(e) => setAccent(e.target.value.replace("#", ""))}
                className="w-8 h-8 border-2 border-black rounded cursor-pointer"
              />
              <span className="text-xs font-bold uppercase">Accent</span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={`#${bg}`}
                onChange={(e) => setBg(e.target.value.replace("#", ""))}
                className="w-8 h-8 border-2 border-black rounded cursor-pointer"
              />
              <span className="text-xs font-bold uppercase">Background</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={`#${cardBg}`}
                onChange={(e) => setCardBg(e.target.value.replace("#", ""))}
                className="w-8 h-8 border-2 border-black rounded cursor-pointer"
              />
              <span className="text-xs font-bold uppercase">Card Body</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={`#${border}`}
                onChange={(e) => setBorder(e.target.value.replace("#", ""))}
                className="w-8 h-8 border-2 border-black rounded cursor-pointer"
              />
              <span className="text-xs font-bold uppercase">Borders</span>
            </div>
          </div>
        </div>

        {/* 5. Action Buttons (Side-by-side with Loading states) */}
        <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 border-2 border-black bg-black text-white hover:bg-gray-800 transition-colors py-3 text-xs font-black uppercase tracking-wider rounded-md disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloading ? "Downloading..." : "Download Card (PNG)"}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              disabled={copying}
              className="flex items-center justify-center gap-1.5 border-2 border-black bg-white hover:bg-gray-50 text-black py-2.5 text-[10px] font-black uppercase tracking-wider rounded-md disabled:opacity-50"
            >
              {copying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copying ? "Copying..." : "Copy Link"}
            </button>

            <button
              onClick={handleShareX}
              disabled={sharing}
              className="flex items-center justify-center gap-1.5 border-2 border-black bg-white hover:bg-gray-50 text-black py-2.5 text-[10px] font-black uppercase tracking-wider rounded-md disabled:opacity-50"
            >
              {sharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              {sharing ? "Sharing..." : "Share on X"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
