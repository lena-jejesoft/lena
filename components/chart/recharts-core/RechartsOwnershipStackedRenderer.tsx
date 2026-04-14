"use client";

import { useMemo, useState } from "react";
import type { CartesianPoint, ChartData, ChartStyle } from "../types";
import { expandSeriesColors, getThemeColors } from "./recharts-wrapper";

type OwnershipSegment = {
  id: string;
  name: string;
  shares: number;
  color: string;
  startPercent: number;
  endPercent: number;
  percent: number;
};

type OwnershipLabel = {
  id: string;
  name: string;
  shares: number;
  color: string;
  percent: number;
  barAnchorX: number;
  labelX: number;
  labelY: number;
  textAnchor: "start" | "middle" | "end";
  isSmall: boolean;
};

const FALLBACK_COLORS = [
  "#E0AE61",
  "#9D4EDD",
  "#D95D77",
  "#4CC9B0",
  "#4EA8DE",
  "#F59E0B",
  "#14B8A6",
  "#A78BFA",
];

function toLatestY(points: unknown[]): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    if (!point || typeof point !== "object") continue;
    const maybePoint = point as Partial<CartesianPoint>;
    if (typeof maybePoint.y === "number" && Number.isFinite(maybePoint.y)) {
      return maybePoint.y;
    }
  }
  return null;
}

function formatPercent(value: number): string {
  const abs = Math.abs(value);
  let digits = 1;
  if (abs < 10) digits = 2;
  if (abs < 1) digits = 3;
  if (abs < 0.1) digits = 4;
  if (abs < 0.01) digits = 5;
  if (abs < 0.001) digits = 7;

  const fixed = value.toFixed(digits);
  const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
  return `${trimmed}%`;
}

function formatShares(value: number): string {
  const rounded = Math.round(value);
  return `${new Intl.NumberFormat("en-US").format(rounded)} shares`;
}

export function RechartsOwnershipStackedRenderer({
  data,
  style,
  height,
  onLegendStateChange,
}: {
  data: ChartData;
  style?: ChartStyle;
  height?: number;
  onLegendStateChange?: (state: { tooltipPayload: any[] | null; hoveredLabel: string | null }) => void;
}) {
  const [themeColors] = useState(getThemeColors());
  const chartHeight = height ?? 400;
  const palette = style?.colorPalette ?? [];

  const segments = useMemo<OwnershipSegment[]>(() => {
    const baseColors =
      palette.length > 0
        ? palette
        : themeColors.seriesColors.length > 0
          ? themeColors.seriesColors
          : FALLBACK_COLORS;
    const expandedColors = expandSeriesColors(baseColors, data.series.length);

    const raw = data.series
      .map((series, index) => {
        const latest = toLatestY(Array.isArray(series.data) ? series.data : []);
        if (latest == null) return null;

        return {
          id: series.id,
          name: series.name || series.id,
          shares: Math.max(0, latest),
          color: series.color ?? expandedColors[index] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        };
      })
      .filter((item): item is { id: string; name: string; shares: number; color: string } => item != null)
      .filter((item) => item.shares > 0);

    const totalShares = raw.reduce((sum, item) => sum + item.shares, 0);
    if (totalShares <= 0) return [];

    let accumulated = 0;
    return raw.map((item) => {
      const percent = (item.shares / totalShares) * 100;
      const startPercent = accumulated;
      const endPercent = Math.min(100, startPercent + percent);
      accumulated = endPercent;

      return {
        ...item,
        startPercent,
        endPercent,
        percent,
      };
    });
  }, [data.series, palette, themeColors.seriesColors]);

  const labels = useMemo<OwnershipLabel[]>(() => {
    const SMALL_THRESHOLD = 5;
    let smallRow = 0;
    let majorRow = 0;

    return segments.map((segment) => {
      const barAnchorX = (segment.startPercent + segment.endPercent) / 2;
      const isSmall = segment.percent < SMALL_THRESHOLD;

      if (isSmall) {
        const labelY = 10 + smallRow * 14;
        smallRow += 1;
        return {
          id: segment.id,
          name: segment.name,
          shares: segment.shares,
          color: segment.color,
          percent: segment.percent,
          barAnchorX,
          labelX: 2.2,
          labelY,
          textAnchor: "start",
          isSmall: true,
        };
      }

      const labelY = 56 + (majorRow % 2) * 10;
      majorRow += 1;

      if (barAnchorX <= 30) {
        return {
          id: segment.id,
          name: segment.name,
          shares: segment.shares,
          color: segment.color,
          percent: segment.percent,
          barAnchorX,
          labelX: 2.2,
          labelY,
          textAnchor: "start",
          isSmall: false,
        };
      }

      if (barAnchorX >= 70) {
        return {
          id: segment.id,
          name: segment.name,
          shares: segment.shares,
          color: segment.color,
          percent: segment.percent,
          barAnchorX,
          labelX: 97.8,
          labelY,
          textAnchor: "end",
          isSmall: false,
        };
      }

      return {
        id: segment.id,
        name: segment.name,
        shares: segment.shares,
        color: segment.color,
        percent: segment.percent,
        barAnchorX,
        labelX: barAnchorX,
        labelY,
        textAnchor: "middle",
        isSmall: false,
      };
    });
  }, [segments]);

  if (segments.length === 0) {
    return (
      <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />
    );
  }

  const panelBackground = style?.background ?? "#1B1D22";

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <div
        className="relative h-full w-full overflow-hidden rounded-md border border-white/10"
        style={{ background: panelBackground }}
        onMouseLeave={() => {
          onLegendStateChange?.({ tooltipPayload: null, hoveredLabel: null });
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {labels.map((label) => {
            const lineY = label.labelY + (label.isSmall ? 2 : 1.5);
            const lineEndX = label.textAnchor === "start"
              ? label.labelX - 0.6
              : label.textAnchor === "end"
                ? label.labelX + 0.6
                : label.labelX;
            return (
              <path
                key={`line-${label.id}`}
                d={`M ${label.barAnchorX} 78 V ${lineY} H ${lineEndX}`}
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={0.18}
              />
            );
          })}
        </svg>

        {labels.map((label) => (
          <div
            key={`label-${label.id}`}
            className="absolute pointer-events-none select-none"
            style={{
              left: `${label.labelX}%`,
              top: `${label.labelY}%`,
              transform:
                label.textAnchor === "middle"
                  ? "translate(-50%, -100%)"
                  : label.textAnchor === "end"
                    ? "translate(-100%, -100%)"
                    : "translate(0, -100%)",
              textAlign:
                label.textAnchor === "middle"
                  ? "center"
                  : label.textAnchor === "end"
                    ? "right"
                    : "left",
            }}
          >
            <div className="whitespace-nowrap text-[clamp(8px,1.35vw,16px)] leading-[1.1] font-semibold text-white">
              {label.name}{" "}
              <span style={{ color: label.color }}>{formatPercent(label.percent)}</span>
            </div>
            <div className="whitespace-nowrap text-[clamp(7px,1.05vw,14px)] leading-[1.1] text-white/65">
              {formatShares(label.shares)}
            </div>
          </div>
        ))}

        <div className="absolute bottom-0 left-0 right-0 h-[22%] min-h-[46px] flex">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="h-full transition-opacity"
              style={{
                width: `${segment.percent}%`,
                background: segment.color,
                opacity: 0.94,
              }}
              onMouseEnter={() => {
                onLegendStateChange?.({
                  tooltipPayload: [
                    {
                      dataKey: segment.id,
                      value: segment.shares,
                      payload: segment,
                    },
                  ],
                  hoveredLabel: segment.name,
                });
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
