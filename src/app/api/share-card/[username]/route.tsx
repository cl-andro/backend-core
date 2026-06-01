import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";

const TIER_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  diamond: "#b9f2ff",
};

const TIER_ORDER = ["diamond", "gold", "silver", "bronze"];

const TIER_LABELS: Record<string, string> = {
  bronze: "RISING",
  silver: "SKILLED",
  gold: "ELITE",
  diamond: "LEGEND",
};

// ─── i18n ─────────────────────────────────────────────────────
type Lang = "en" | "pt";

const i18n: Record<Lang, {
  inTheCity: string;
  commits: string;
  repos: string;
  stars: string;
  kudos: string;
  cta: string;
  notFound: string;
}> = {
  en: {
    inTheCity: "in the city",
    commits: "COMMITS",
    repos: "REPOS",
    stars: "STARS",
    kudos: "KUDOS",
    cta: "Can you beat this?",
    notFound: "Developer not found",
  },
  pt: {
    inTheCity: "na cidade",
    commits: "COMMITS",
    repos: "REPOS",
    stars: "ESTRELAS",
    kudos: "KUDOS",
    cta: "Consegue me superar?",
    notFound: "Desenvolvedor nao encontrado",
  },
};

// ─── Colors ───────────────────────────────────────────────────
const accent = "#c8e64a";
const bg = "#0d0d0f";
const cream = "#e8dcc8";
const border = "#2a2a30";
const cardBg = "#1c1c20";
const muted = "#8c8c9c";

// ─── Repo Blocks (GitHub-style Contribution Grid) ─────────────
function renderRepoBlocks(color: string, contributions: number, scale = 1) {
  const shades = ["#0e4429", "#006d32", "#26a641", "#39d353"];
  const cols = 20; // 20 columns
  const rows = 5;  // 5 rows
  const blocks = [];
  
  let seed = contributions || 12345;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const cellSize = 12 * scale;
  const cellMargin = 2 * scale;
  const borderRadius = 2 * scale;

  for (let r = 0; r < rows; r++) {
    const rowCells = [];
    for (let c = 0; c < cols; c++) {
      const randVal = nextRand();
      let bgCol = "#161b22"; // default dark grid color
      
      if (randVal < 0.65) {
        const intensity = Math.floor(nextRand() * shades.length);
        bgCol = shades[intensity];
      }
      
      rowCells.push(
        <div
          key={c}
          style={{
            width: cellSize,
            height: cellSize,
            backgroundColor: bgCol,
            borderRadius: borderRadius,
            margin: cellMargin,
          }}
        />
      );
    }
    blocks.push(
      <div key={r} style={{ display: "flex" }}>
        {rowCells}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: scale,
        marginTop: 20 * scale,
        border: `${2 * scale}px solid ${color}30`,
        padding: `${10 * scale}px ${12 * scale}px`,
        borderRadius: 8 * scale,
        backgroundColor: "#0d1117",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 10 * scale,
          color: color,
          textTransform: "uppercase",
          fontWeight: "bold",
          marginBottom: 6 * scale,
        }}
      >
        Contributions & Repositories
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {blocks}
      </div>
    </div>
  );
}

// ─── GET handler ──────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "landscape";
  const lang = (request.nextUrl.searchParams.get("lang") === "pt" ? "pt" : "en") as Lang;

  // Custom theme options from query parameters
  const queryAccent = request.nextUrl.searchParams.get("accent");
  const queryBg = request.nextUrl.searchParams.get("bg");
  const queryCardBg = request.nextUrl.searchParams.get("cardBg");
  const queryBorder = request.nextUrl.searchParams.get("border");

  const accent = queryAccent ? `#${queryAccent.replace("#", "")}` : "#c8e64a";
  const bg = queryBg ? `#${queryBg.replace("#", "")}` : "#0d0d0f";
  const cardBg = queryCardBg ? `#${queryCardBg.replace("#", "")}` : "#1c1c20";
  const border = queryBorder ? `#${queryBorder.replace("#", "")}` : "#2a2a30";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: dev } = await supabase
    .from("developers")
    .select(
      "id, github_login, name, avatar_url, contributions, contributions_total, public_repos, total_stars, rank, kudos_count"
    )
    .eq("github_login", username.toLowerCase())
    .single();

  if (!dev) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            fontFamily: "sans-serif",
            color: cream,
            fontSize: 48,
            border: `6px solid ${border}`,
          }}
        >
          {i18n[lang].notFound}
        </div>
      ),
      {
        width: 1200,
        height: 675,
      }
    );
  }

  // Fetch achievements
  const { data: devAchievements } = await supabase
    .from("developer_achievements")
    .select("achievement_id, achievements(name, tier)")
    .eq("developer_id", dev.id);

  const achievements = (devAchievements ?? []).map(
    (a: Record<string, unknown>) => ({
      name:
        ((a.achievements as Record<string, unknown>)?.name as string) ??
        (a.achievement_id as string),
      tier:
        ((a.achievements as Record<string, unknown>)?.tier as string) ??
        "bronze",
    })
  );

  // Find highest tier
  const highestTier =
    achievements.length > 0
      ? TIER_ORDER.find((tier) => achievements.some((a) => a.tier === tier)) ??
        "bronze"
      : null;

  // Effective contributions (matches rank calculation)
  const contribs = (dev.contributions_total && dev.contributions_total > 0) ? dev.contributions_total : dev.contributions;
  const devEff = { ...dev, contributions: contribs };

  const t = i18n[lang];
  if (format === "stories") {
    return renderStories(devEff, achievements, highestTier, t, lang, accent, bg, cardBg, border);
  }
  return renderLandscape(devEff, achievements, highestTier, t, accent, bg, cardBg, border);
}

// ─── Landscape (1200x675) ─────────────────────────────────────
function renderLandscape(
  dev: Record<string, unknown>,
  achievements: { name: string; tier: string }[],
  highestTier: string | null,
  t: typeof i18n.en,
  accent: string,
  bg: string,
  cardBg: string,
  border: string
) {
  const stats = [
    { label: t.commits, value: (dev.contributions as number).toLocaleString() },
    { label: t.repos, value: (dev.public_repos as number).toLocaleString() },
    { label: t.stars, value: (dev.total_stars as number).toLocaleString() },
    { label: t.kudos, value: ((dev.kudos_count as number) ?? 0).toLocaleString() },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: bg,
          fontFamily: "sans-serif",
          border: `6px solid ${border}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Left Column: Avatar, Username, Repo Blocks */}
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 40,
            width: 460,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {dev.avatar_url ? (
            <img
              src={dev.avatar_url as string}
              width={180}
              height={180}
              style={{ 
                borderRadius: 90,
                border: `4px solid ${accent}`,
              }}
            />
          ) : null}
          
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14, gap: 4 }}>
            {dev.name ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 44,
                  fontWeight: "bold",
                  color: cream,
                }}
              >
                {dev.name as string}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: muted,
                fontWeight: "600",
              }}
            >
              {`@${dev.github_login}`}
            </div>
            
            <div
              style={{
                display: "flex",
                fontSize: 16,
                fontWeight: "bold",
                color: accent,
                border: `2px solid ${accent}`,
                borderRadius: 6,
                padding: "4px 14px",
                marginTop: 8,
                alignSelf: "flex-start",
                textTransform: "uppercase",
              }}
            >
              MY CONTRIBUTION
            </div>
          </div>

          {/* Repo blocks in green (scale = 1.3 to match 460px left column width perfectly) */}
          {renderRepoBlocks(accent, dev.contributions as number, 1.3)}
        </div>

        {/* Right Column: Stats & Achievements */}
        <div
          style={{
            position: "absolute",
            left: 540,
            top: 40,
            width: 600,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Stats 2x2 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  width: 290,
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: cardBg,
                  border: `2px solid ${border}`,
                  borderRadius: 8,
                  padding: "24px 32px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    color: muted,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 54,
                    fontWeight: "bold",
                    color: accent,
                    marginTop: 6,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Achievements + Tier label */}
          {achievements.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 32,
                flexWrap: "wrap",
              }}
            >
              {highestTier && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    fontWeight: "bold",
                    color: TIER_COLORS[highestTier],
                    border: `2px solid ${TIER_COLORS[highestTier]}`,
                    borderRadius: 6,
                    padding: "4px 12px",
                    textTransform: "uppercase",
                  }}
                >
                  {TIER_LABELS[highestTier] ?? highestTier.toUpperCase()}
                </div>
              )}
              {achievements.slice(0, 4).map((ach, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    fontSize: 13,
                    fontWeight: "600",
                    color: TIER_COLORS[ach.tier] ?? accent,
                    border: `2px solid ${TIER_COLORS[ach.tier] ?? accent}`,
                    borderRadius: 5,
                    padding: "3px 10px",
                    textTransform: "uppercase",
                  }}
                >
                  {ach.name}
                </div>
              ))}
              {achievements.length > 4 && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 13,
                    fontWeight: "bold",
                    color: muted,
                  }}
                >
                  +{achievements.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Branding/Last text */}
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: muted,
              fontWeight: "800",
              textTransform: "uppercase",
              marginTop: 48,
              letterSpacing: 1,
            }}
          >
            MY CONTRIBUTION TO THIS WORLD
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 675,
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}

// ─── Stories (1080x1920) ───────────────────────────────────────
function renderStories(
  dev: Record<string, unknown>,
  achievements: { name: string; tier: string }[],
  highestTier: string | null,
  t: typeof i18n.en,
  lang: Lang,
  accent: string,
  bg: string,
  cardBg: string,
  border: string
) {
  const contributions = dev.contributions as number;

  const stats = [
    { label: t.commits, value: contributions.toLocaleString() },
    { label: t.repos, value: (dev.public_repos as number).toLocaleString() },
    { label: t.stars, value: (dev.total_stars as number).toLocaleString() },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: bg,
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
          alignItems: "center",
        }}
      >
        {/* ── Profile ── */}
        <div
          style={{
            position: "absolute",
            top: 250,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 920,
          }}
        >
          {dev.avatar_url ? (
            <img
              src={dev.avatar_url as string}
              width={280}
              height={280}
              style={{ 
                borderRadius: 140,
                border: `6px solid ${accent}` 
              }}
            />
          ) : null}
          {dev.name ? (
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: "bold",
                color: cream,
                marginTop: 24,
                textAlign: "center",
                justifyContent: "center",
              }}
            >
              {dev.name as string}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 36,
              color: muted,
              fontWeight: "600",
              marginTop: 8,
            }}
          >
            @{dev.github_login as string}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: "bold",
                color: accent,
                border: `2px solid ${accent}`,
                borderRadius: 6,
                padding: "6px 18px",
                textTransform: "uppercase",
              }}
            >
              MY CONTRIBUTION
            </div>
            {highestTier ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: "bold",
                  color: TIER_COLORS[highestTier],
                  border: `2px solid ${TIER_COLORS[highestTier]}`,
                  borderRadius: 6,
                  padding: "6px 18px",
                  textTransform: "uppercase",
                }}
              >
                {TIER_LABELS[highestTier] ?? highestTier.toUpperCase()}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Repo Blocks (scaled to 2.4 for Stories) ── */}
        <div
          style={{
            position: "absolute",
            top: 790,
            width: 920,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {renderRepoBlocks(accent, contributions, 2.4)}
        </div>

        {/* ── Stats: 3 across, clean ── */}
        <div
          style={{
            position: "absolute",
            top: 1200,
            left: 80,
            width: 920,
            display: "flex",
            justifyContent: "space-around",
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", fontSize: 64, fontWeight: "bold", color: accent }}>
                {stat.value}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  color: muted,
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  marginTop: 8,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Achievement badges ── */}
        {achievements.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: 1420,
              left: 80,
              width: 920,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
            }}
          >
            {achievements.slice(0, 5).map((ach, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  fontSize: 18,
                  fontWeight: "600",
                  color: TIER_COLORS[ach.tier] ?? accent,
                  border: `2px solid ${TIER_COLORS[ach.tier] ?? accent}`,
                  borderRadius: 5,
                  padding: "4px 12px",
                  textTransform: "uppercase",
                }}
              >
                {ach.name}
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Branding bottom ── */}
        <div
          style={{
            position: "absolute",
            top: 1540,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 1080,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: muted,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            MY CONTRIBUTION TO THIS WORLD
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}
