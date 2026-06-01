"use client";

// 7x6 pixel-art heart used in the fly HUD for the HP display.
// Crisp at any size thanks to shapeRendering="crispEdges".

const PATTERN: number[][] = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

interface Props {
  filled: boolean;
  size?: number;
  /** Color when filled. Defaults to city lime accent. */
  color?: string;
  /** Outline color when empty. */
  emptyColor?: string;
}

export default function PixelHeart({
  filled,
  size = 16,
  color = "#c8e64a",
  emptyColor = "#5c5c6c",
}: Props) {
  return (
    <svg
      width={size}
      height={(size * 6) / 7}
      viewBox="0 0 7 6"
      shapeRendering="crispEdges"
      style={{ display: "block" }}
    >
      {PATTERN.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={filled ? color : "transparent"}
              stroke={!filled ? emptyColor : undefined}
              strokeWidth={!filled ? 0.18 : 0}
            />
          ) : null
        )
      )}
    </svg>
  );
}
