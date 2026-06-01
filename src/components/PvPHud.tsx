"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import type { RemotePilot, SelfPvpState, KillFeedEntry } from "@/lib/useFlyPresence";
import { getHappyHourStatus, formatCountdown } from "@/lib/happyHour";

// Dev-humor tips shown on the death screen — rotated randomly so each
// death feels a little different.
const DEATH_TIPS = [
  "tip: shielded for 3s after reboot",
  "tip: toggle Force Push off in the top bar to fly safe",
  "tip: 2× XP during Force Push Happy Hour",
  "have you tried turning it off and on again?",
  "stack overflow at line 3",
  "panic: runtime error",
  "segmentation fault (core dumped)",
  "exit code 137 — out of memory",
  "git revert HEAD next time",
  "did not match any files known to git",
];

// All visual elements here follow the city pattern:
//   border-[3px] border-border bg-bg/70 backdrop-blur-sm
// No glow, no lime-as-background, no isolated cards. Lime is only an
// accent for "happy hour" highlights (it's a special event) and for the
// hit-marker confirmation flash.

export interface SelfPosLike { x: number; z: number; }

const CREAM = "#e8dcc8";
const CREAM_DARK = "#c8b89c";
const MUTED = "#8c8c9c";
const BORDER = "#2a2a30";
const LIME = "#c8e64a";
const DAMAGE = "#d44";

interface PvPHudProps {
  selfStateRef: React.MutableRefObject<SelfPvpState>;
  pilotsRef: React.MutableRefObject<Map<string, RemotePilot>>;
  pvpEnabled: boolean;
  /** Toggling is owned by the central status card now; kept for compatibility. */
  onTogglePvp: (enabled: boolean) => void;
  selfPosRef?: React.MutableRefObject<SelfPosLike>;
  selfYawRef?: React.MutableRefObject<number>;
}

interface Snapshot {
  lastAttackerId: string | null;
  lastAttackerAt: number;
  attackerLogin: string | null;
  attackerX: number;
  attackerZ: number;
  lastHitConfirmedAt: number;
  lastDamageAt: number;
  downedUntil: number;
  killFeed: KillFeedEntry[];
  now: number;
  selfX: number;
  selfZ: number;
  selfYaw: number;
}

function emptySnapshot(): Snapshot {
  return {
    lastAttackerId: null,
    lastAttackerAt: 0,
    attackerLogin: null,
    attackerX: 0,
    attackerZ: 0,
    lastHitConfirmedAt: 0,
    lastDamageAt: 0,
    downedUntil: 0,
    killFeed: [],
    now: Date.now(),
    selfX: 0,
    selfZ: 0,
    selfYaw: 0,
  };
}

export default function PvPHud({
  selfStateRef,
  pilotsRef,
  pvpEnabled,
  selfPosRef,
  selfYawRef,
}: PvPHudProps) {
  const [snap, setSnap] = useState<Snapshot>(emptySnapshot);
  const [deathTip, setDeathTip] = useState("");
  const [killerNameOnDeath, setKillerNameOnDeath] = useState<string | null>(null);
  const [respawnedAt, setRespawnedAt] = useState(0);
  const wasDownedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = selfStateRef.current;
      const attacker = s.lastAttackerId ? pilotsRef.current.get(s.lastAttackerId) : null;
      const nowMs = Date.now();
      const isDownedNow = s.downedUntil > nowMs;

      // Edge transitions: dying / respawning
      if (isDownedNow !== wasDownedRef.current) {
        if (isDownedNow) {
          // Just died — pick a tip and freeze the killer name so the
          // overlay shows who killed us even if lastAttackerId rotates.
          setDeathTip(DEATH_TIPS[Math.floor(Math.random() * DEATH_TIPS.length)]);
          setKillerNameOnDeath(attacker ? attacker.login : null);
        } else {
          // Just respawned — flash the "DEPLOYED" confirmation
          setRespawnedAt(nowMs);
        }
        wasDownedRef.current = isDownedNow;
      }

      setSnap({
        lastAttackerId: s.lastAttackerId,
        lastAttackerAt: s.lastAttackerAt,
        attackerLogin: attacker ? attacker.login : null,
        attackerX: s.lastAttackerX,
        attackerZ: s.lastAttackerZ,
        lastHitConfirmedAt: s.lastHitConfirmedAt,
        lastDamageAt: s.lastDamageAt,
        downedUntil: s.downedUntil,
        killFeed: s.killFeed,
        now: nowMs,
        selfX: selfPosRef?.current.x ?? 0,
        selfZ: selfPosRef?.current.z ?? 0,
        selfYaw: selfYawRef?.current ?? 0,
      });
    }, 60);
    return () => clearInterval(interval);
  }, [selfStateRef, pilotsRef, selfPosRef, selfYawRef]);

  const happyHour = useMemo(() => getHappyHourStatus(new Date(snap.now)), [snap.now]);
  const isDowned = snap.downedUntil > snap.now;

  const hitMarkerAge = snap.now - snap.lastHitConfirmedAt;
  const showHitMarker = snap.lastHitConfirmedAt > 0 && hitMarkerAge < 250;
  const hitMarkerOpacity = showHitMarker ? Math.max(0, 1 - hitMarkerAge / 250) : 0;

  const damageAge = snap.now - snap.lastDamageAt;
  const showDamageFlash = snap.lastDamageAt > 0 && damageAge < 200;
  const damageFlashOpacity = showDamageFlash ? Math.max(0, 1 - damageAge / 200) : 0;

  const showDamageDir = snap.lastDamageAt > 0 && damageAge < 3_000;
  const dirOpacity = showDamageDir ? Math.max(0, 1 - damageAge / 3_000) : 0;
  let damageDirAngleDeg = 0;
  if (showDamageDir) {
    const dx = snap.attackerX - snap.selfX;
    const dz = snap.attackerZ - snap.selfZ;
    const worldAngle = Math.atan2(dx, -dz);
    const screenAngle = worldAngle - snap.selfYaw;
    damageDirAngleDeg = (screenAngle * 180) / Math.PI;
  }

  const visibleKillFeed = snap.killFeed.filter((e) => snap.now - e.at < 6_000);

  return (
    <>
      {/* ─── Happy Hour banner — top center, BELOW the unified status
          card (which sits at top-4 with ~40px height). Same `border-[3px]
          border-border bg-bg/70 backdrop-blur-sm` template as every other
          panel in the city. Lime only appears on the "2× XP" highlight. ── */}
      {happyHour.active && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 transform"
          style={{ top: 72 }}
        >
          <div className="inline-flex items-center gap-2 border-[3px] border-border bg-bg/70 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-[10px]">🔥</span>
            <span className="text-[10px] uppercase text-cream tracking-wider">Force Push Happy Hour</span>
            <span className="mx-1 text-border">|</span>
            <span className="text-[10px] uppercase font-bold" style={{ color: LIME, letterSpacing: "0.05em" }}>
              2× XP
            </span>
            <span className="mx-1 text-border">|</span>
            <span className="text-[10px]" style={{ color: LIME }}>
              {formatCountdown(happyHour.endsInMs)}
            </span>
          </div>
        </div>
      )}

      {/* ─── Killfeed — plain text in the top-right corner ──
          No cards, no borders — fading text only, like Overwatch / CoD. */}
      {visibleKillFeed.length > 0 && (
        <div
          className="pointer-events-none fixed z-50 text-right"
          style={{
            top: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            alignItems: "flex-end",
            fontFamily: "Silkscreen, monospace",
            maxWidth: 320,
          }}
        >
          {visibleKillFeed.map((e) => {
            const age = snap.now - e.at;
            const opacity = age < 4_000 ? 1 : Math.max(0, 1 - (age - 4_000) / 2_000);
            return (
              <div
                key={e.id}
                style={{
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: CREAM_DARK,
                  opacity,
                  textShadow: "0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000",
                  whiteSpace: "nowrap",
                }}
              >
                {e.happyHour && <span style={{ marginRight: 4 }}>🔥</span>}
                <span style={{ color: e.killerWasSelf ? LIME : CREAM_DARK }}>
                  {e.killerWasSelf ? "you" : `@${e.killerLogin}`}
                </span>
                <span style={{ color: MUTED, margin: "0 6px" }}>→</span>
                <span style={{ color: e.victimWasSelf ? DAMAGE : CREAM_DARK }}>
                  {e.victimWasSelf ? "you" : `@${e.victimLogin}`}
                </span>
                {e.killerWasSelf && (
                  <span style={{ color: LIME, marginLeft: 8 }}>
                    +{e.happyHour ? 10 : 5} XP
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Center: hit marker (X flash on confirmed hit) ─── */}
      {showHitMarker && pvpEnabled && (
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 transform"
          style={{ width: 28, height: 28, opacity: hitMarkerOpacity }}
        >
          <div style={{ position: "absolute", left: 4, top: 4, width: 20, height: 3, background: LIME, transform: "rotate(45deg)", transformOrigin: "center" }} />
          <div style={{ position: "absolute", left: 4, top: 4, width: 20, height: 3, background: LIME, transform: "rotate(-45deg)", transformOrigin: "center", marginTop: 18 }} />
        </div>
      )}

      {/* ─── Damage vignette pulse on incoming damage ─── */}
      {showDamageFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-[55]"
          style={{
            opacity: damageFlashOpacity,
            boxShadow: `inset 0 0 120px 40px ${DAMAGE}`,
          }}
        />
      )}

      {/* ─── Damage direction indicator (arrow at screen edge) ─ */}
      {showDamageDir && (selfPosRef || selfYawRef) && (
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-50"
          style={{
            transform: `translate(-50%, -50%) rotate(${damageDirAngleDeg}deg)`,
            width: 6,
            height: 220,
            opacity: dirOpacity,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderBottom: `16px solid ${DAMAGE}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 16,
              transform: "translateX(-50%)",
              width: 4,
              height: 60,
              background: DAMAGE,
            }}
          />
        </div>
      )}

      {/* ─── "Shot by @user" callout below the central status card ── */}
      {snap.attackerLogin && snap.lastAttackerAt > 0 && snap.now - snap.lastAttackerAt < 5_000 && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 transform"
          style={{ top: happyHour.active ? 108 : 72 }}
        >
          <div className="inline-flex items-center gap-2 border-[3px] bg-bg/70 px-3 py-1 backdrop-blur-sm"
               style={{ borderColor: DAMAGE }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: DAMAGE }}>
              shot by @{snap.attackerLogin}
            </span>
          </div>
        </div>
      )}

      {/* ─── BUILD FAILED overlay on death — terminal-style ─── */}
      {isDowned && (() => {
        const secsLeft = Math.max(0, Math.ceil((snap.downedUntil - snap.now) / 1000));
        return (
          <div
            className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
            style={{
              background: "rgba(0, 0, 0, 0.78)",
              backdropFilter: "blur(3px)",
              animation: "pvp-death-in 0.18s ease-out",
            }}
          >
            {/* Subtle red scanline at the top, like a terminal error */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{
                height: 2,
                background: `linear-gradient(90deg, transparent 0%, ${DAMAGE} 50%, transparent 100%)`,
                opacity: 0.7,
              }}
            />
            <div
              className="text-center"
              style={{
                background: "rgba(28,28,32,0.95)",
                border: `3px solid ${DAMAGE}`,
                padding: "28px 56px",
                minWidth: 360,
                fontFamily: "Silkscreen, monospace",
              }}
            >
              {/* Header — like a process crash banner */}
              <div
                style={{
                  fontSize: 9,
                  color: DAMAGE,
                  letterSpacing: "0.3em",
                  opacity: 0.7,
                  marginBottom: 6,
                }}
              >
                ─── error ───
              </div>
              {/* Main "BUILD FAILED" */}
              <div
                style={{
                  color: DAMAGE,
                  fontSize: 42,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                  textShadow: `0 0 12px ${DAMAGE}55`,
                }}
              >
                Build Failed
              </div>
              {/* Killer attribution — only if we know who did it */}
              {killerNameOnDeath && (
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 11,
                    color: CREAM,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  killed by{" "}
                  <span style={{ color: DAMAGE, fontWeight: "bold" }}>
                    @{killerNameOnDeath}
                  </span>
                </div>
              )}
              {/* Animated countdown */}
              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: MUTED,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                >
                  rebooting in
                </span>
                <span
                  key={secsLeft}
                  style={{
                    fontSize: 28,
                    color: CREAM,
                    letterSpacing: "0.05em",
                    minWidth: 22,
                    display: "inline-block",
                    animation: "pvp-countdown-pulse 0.4s ease-out",
                  }}
                >
                  {secsLeft}
                </span>
              </div>
              {/* Dev-humor tip — rotates per death */}
              {deathTip && (
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 12,
                    borderTop: `1px solid ${BORDER}`,
                    fontSize: 9,
                    color: MUTED,
                    letterSpacing: "0.08em",
                    fontStyle: "italic",
                  }}
                >
                  {deathTip}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── DEPLOYED — brief confirmation flash when respawn lands ── */}
      {respawnedAt > 0 && snap.now - respawnedAt < 1400 && (
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-[58] -translate-x-1/2 -translate-y-1/2 transform"
          style={{
            animation: "pvp-deployed 1.4s ease-out forwards",
          }}
        >
          <div
            style={{
              background: "rgba(28,28,32,0.92)",
              border: `3px solid ${LIME}`,
              padding: "10px 24px",
              fontFamily: "Silkscreen, monospace",
              fontSize: 16,
              color: LIME,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              textShadow: `0 0 10px ${LIME}55`,
            }}
          >
            ⚡ Deployed
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pvp-death-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pvp-countdown-pulse {
          0% { transform: scale(1.4); opacity: 0; }
          40% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pvp-deployed {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          25% { transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
