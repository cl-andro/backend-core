"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Landmark } from "@/lib/landmarks/types";
import { ToastContainer, type Toast } from "./toast";

export function LandmarksDashboard() {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/landmarks");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setLandmarks(json.landmarks ?? []);
    } catch {
      setError("Failed to load landmarks");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const total = landmarks.length;
  const activeCount = landmarks.filter((l) => l.active).length;
  const hiddenCount = total - activeCount;
  const sorted = [...landmarks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const handleToggleActive = useCallback(
    async (l: Landmark) => {
      try {
        const res = await fetch(`/api/admin/landmarks/${l.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: !l.active }),
        });
        if (!res.ok) throw new Error("Failed");
        addToast("success", l.active ? "Hidden from rotation" : "Shown in rotation");
        fetchAll();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : String(e));
      }
    },
    [addToast, fetchAll],
  );

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-6 lg:p-8">
      {loading && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-border">
          <div
            className="h-full w-1/3 bg-lime"
            style={{ animation: "loading-slide 1s ease-in-out infinite" }}
          />
          <style>{`@keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl text-cream">LANDMARKS</h1>
            <p className="mt-1 text-xs text-muted">
              {total} total / {activeCount} active
              {hiddenCount > 0 && <span className="ml-1 text-dim">/ {hiddenCount} hidden</span>}
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin/jobs"
              className="cursor-pointer border border-border px-4 py-2 text-xs text-muted transition-colors hover:border-border-light hover:text-cream"
            >
              BACK
            </a>
            <a
              href="/"
              target="_blank"
              className="cursor-pointer border border-border px-4 py-2 text-xs text-muted transition-colors hover:border-border-light hover:text-cream"
            >
              VIEW CITY
            </a>
            <Link
              href="/admin/landmarks/new"
              className="cursor-pointer border-2 border-lime px-4 py-1.5 text-xs text-lime transition-colors hover:bg-lime/10"
            >
              NEW LANDMARK
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="TOTAL" value={total} />
          <Card label="ACTIVE" value={activeCount} accent="lime" />
          <Card label="HIDDEN" value={hiddenCount} />
          <Card label="SLOTS" value={3} />
        </div>

        {error && (
          <div className="mb-4 border border-red-800 bg-red-900/20 p-4 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="border-[3px] border-border bg-bg">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] border-b border-border px-4 py-2.5 text-[10px] uppercase tracking-wider text-dim">
            <div>Name · Slug</div>
            <div>Kind</div>
            <div>Priority</div>
            <div>State</div>
            <div className="text-right">Actions</div>
          </div>

          {sorted.length === 0 && !loading && (
            <div className="px-4 py-12 text-center text-xs text-muted">
              No landmarks yet. Click NEW LANDMARK to create the first.
            </div>
          )}

          {sorted.map((l) => (
            <Row key={l.id} landmark={l} onToggleActive={() => handleToggleActive(l)} />
          ))}
        </div>

        <p className="mt-4 text-[10px] text-muted">
          3 physical slots pull from the active pool at render time. Priority controls selection
          weight; the highest-priority landmark pins to the prime slot (next to the Arcade).
        </p>
      </div>
    </div>
  );
}

function Card({
  label, value, accent,
}: { label: string; value: number | string; accent?: "lime" }) {
  return (
    <div className="border-[3px] border-border bg-bg p-4">
      <p className="text-[10px] text-dim">{label}</p>
      <p className={`mt-1 text-2xl ${accent === "lime" ? "text-lime" : "text-cream"}`}>{value}</p>
    </div>
  );
}

function Row({ landmark, onToggleActive }: { landmark: Landmark; onToggleActive: () => void }) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center border-b border-border px-4 py-3 text-xs transition-colors hover:bg-bg-raised/50 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0"
            style={{ backgroundColor: landmark.accent }}
          />
          <span className="truncate text-cream">{landmark.name}</span>
        </div>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-dim">
          {landmark.slug}
        </span>
      </div>
      <div className="text-dim">
        {landmark.buildingKind === "custom" ? (
          <span>
            <span className="text-cream">custom</span>
            <span className="ml-1 text-[10px]">({landmark.customComponent})</span>
          </span>
        ) : (
          <span className="text-cream">tower</span>
        )}
      </div>
      <div className="text-cream">{landmark.priority}</div>
      <div>
        {landmark.active ? (
          <span className="border border-lime/60 bg-lime/10 px-2 py-0.5 text-[10px] text-lime">
            LIVE
          </span>
        ) : (
          <span className="border border-border px-2 py-0.5 text-[10px] text-dim">HIDDEN</span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onToggleActive}
          className="cursor-pointer border border-border px-2.5 py-1 text-[10px] text-muted transition-colors hover:border-border-light hover:text-cream"
        >
          {landmark.active ? "HIDE" : "SHOW"}
        </button>
        <Link
          href={`/admin/landmarks/${landmark.id}`}
          className="cursor-pointer border-2 border-lime px-2.5 py-1 text-[10px] text-lime transition-colors hover:bg-lime/10"
        >
          EDIT
        </Link>
      </div>
    </div>
  );
}
