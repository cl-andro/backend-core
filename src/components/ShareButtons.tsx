"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  login: string;
  contributions: number;
  rank: number | null;
  accent: string;
  shadow: string;
}

type CardLang = "en" | "pt";

export default function ShareButtons({
  login,
  contributions,
  rank,
  accent,
  shadow,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [cardLang, setCardLang] = useState<CardLang>("en");
  const menuRef = useRef<HTMLDivElement>(null);

  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dev/${login}`
      : `/dev/${login}`;

  const tweetText = `My GitHub just turned into a building. ${contributions.toLocaleString()} contributions, Rank #${rank ?? "?"}. What does yours look like?`;

  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (format: "landscape" | "stories") => {
    setShowFormatMenu(false);
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/share-card/${login}?format=${format}&lang=${cardLang}`
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cluster-git.${login}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // Close menu on outside click
  useEffect(() => {
    if (!showFormatMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFormatMenu]);

  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
      <a
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(profileUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-press px-5 py-2.5 text-[10px] font-bold text-black border-2 border-black rounded-md hover:bg-gray-50 transition-colors"
      >
        Share on X
      </a>

      {/* Download Card */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowFormatMenu((v) => !v)}
          disabled={downloading}
          className="btn-press flex items-center justify-center gap-1.5 px-5 py-2.5 text-[10px] font-bold text-black border-2 border-black rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {downloading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {downloading ? "Downloading..." : "Download Card"}
        </button>

        {showFormatMenu && (
          <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 border-2 border-black bg-white p-2 rounded-md shadow-lg min-w-[150px]">
            {/* Language toggle */}
            <div className="mb-2 flex justify-center gap-1">
              <button
                onClick={() => setCardLang("en")}
                className="px-3 py-1 text-[10px] font-bold transition-colors text-black"
                style={{
                  borderBottom:
                    cardLang === "en" ? `2px solid black` : "2px solid transparent",
                }}
              >
                EN
              </button>
              <button
                onClick={() => setCardLang("pt")}
                className="px-3 py-1 text-[10px] font-bold transition-colors text-black"
                style={{
                  borderBottom:
                    cardLang === "pt" ? `2px solid black` : "2px solid transparent",
                }}
              >
                PT
              </button>
            </div>
            <button
              onClick={() => handleDownload("landscape")}
              className="block w-full whitespace-nowrap px-4 py-2 text-left text-[10px] text-black font-semibold transition-colors hover:bg-gray-100 rounded-sm"
            >
              Landscape (1200x675)
            </button>
            <button
              onClick={() => handleDownload("stories")}
              className="block w-full whitespace-nowrap px-4 py-2 text-left text-[10px] text-black font-semibold transition-colors hover:bg-gray-100 rounded-sm"
            >
              Stories (1080x1920)
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleCopy}
        className="btn-press px-5 py-2.5 text-[10px] font-bold text-black border-2 border-black rounded-md hover:bg-gray-50 transition-colors"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
