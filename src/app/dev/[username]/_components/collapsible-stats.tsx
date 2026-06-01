"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleStatsProps {
  children: React.ReactNode;
}

export default function CollapsibleStats({ children }: CollapsibleStatsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Toggle button - only visible on mobile (hidden on md and up) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:hidden bg-white border border-[#dadde1] text-[#3b5998] hover:bg-gray-50 font-bold py-2.5 px-4 rounded-md shadow-sm flex items-center justify-between text-xs transition-all active:scale-[0.98] cursor-pointer"
      >
        <span className="font-sans">
          {isOpen ? "Hide Achievements, Items & Stats" : "Show Achievements, Items & Stats"}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-[#3b5998]" /> : <ChevronDown className="h-4 w-4 text-[#3b5998]" />}
      </button>

      {/* Content wrapper - hidden on mobile by default, always visible on desktop */}
      <div className={`${isOpen ? "block animate-fade-in" : "hidden"} md:block space-y-6`}>
        {children}
      </div>
    </div>
  );
}
