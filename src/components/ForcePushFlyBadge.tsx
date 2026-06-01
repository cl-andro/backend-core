"use client";

import { useEffect, useState } from "react";
import { getHappyHourStatus, formatCountdown } from "@/lib/happyHour";

// Live badge that surfaces "🔥 2X XP" on top of the Fly button whenever
// a Force Push Happy Hour is live. Sits absolutely over its parent (which
// must be `relative`) so it doesn't disturb the existing button layout.
export default function ForcePushFlyBadge() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(i);
  }, []);
  // suppress unused-var lint
  void tick;

  const hh = getHappyHourStatus();
  if (!hh.active) return null;

  return (
    <div
      className="pointer-events-none absolute -top-2 -right-3 z-20 select-none"
      style={{
        background: "#c8e64a",
        color: "#1c1c20",
        padding: "2px 6px",
        fontFamily: "Silkscreen, monospace",
        fontSize: "9px",
        letterSpacing: "0.08em",
        boxShadow: "2px 2px 0 0 #8aaa1a, 0 0 12px rgba(200,230,74,0.6)",
        transform: "rotate(6deg)",
        animation: "fp-fly-badge-pulse 1.4s ease-in-out infinite",
      }}
    >
      🔥 2× XP · {formatCountdown(hh.endsInMs)}
      <style jsx>{`
        @keyframes fp-fly-badge-pulse {
          0%, 100% { transform: rotate(6deg) scale(1); }
          50%      { transform: rotate(6deg) scale(1.06); }
        }
      `}</style>
    </div>
  );
}
