"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer } from "recharts";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { expandSeriesColors, getThemeColors } from "./recharts-wrapper";

type GaugeNeedle = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type GaugeScale = {
  min: number;
  max: number;
  ticks: number[];
};

const GAUGE_START_ANGLE = -210;
const GAUGE_END_ANGLE = 30;
const DEFAULT_TICK_STEPS = 4;
const ARC_STROKE_WIDTH = 14;

const FALLBACK_NEEDLE_COLORS = ["#4ECDC4", "#5B9BD5", "#E57B53", "#9B8AA6"];
const ARC_SEGMENT_COLORS = [
  "#9F2936",
  "#C74442",
  "#DF7C27",
  "#E0BA2F",
  "#87C74A",
  "#2F9E7D",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPolarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (Math.PI / 180) * angleDeg;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = toPolarPoint(cx, cy, radius, startAngle);
  const end = toPolarPoint(cx, cy, radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function toNeedleAngle(value: number, scale: GaugeScale): number {
  const ratio =
    scale.max === scale.min
      ? 0
      : clamp((value - scale.min) / (scale.max - scale.min), 0, 1);
  return GAUGE_START_ANGLE + ratio * (GAUGE_END_ANGLE - GAUGE_START_ANGLE);
}

function toRounded(value: number, digits = 6): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function resolveNiceStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
  const normalized = step / magnitude;
  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function buildGaugeScale(values: number[]): GaugeScale {
  const numericValues = values.filter((v) => Number.isFinite(v));
  if (numericValues.length === 0) {
    return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
  }

  let min = Math.min(...numericValues, 0);
  let max = Math.max(...numericValues, 0);
  if (min === max) {
    // 값이 하나뿐인 경우에도 바늘이 움직일 수 있도록 범위를 만든다.
    const pad = Math.max(1, Math.abs(min) * 0.3);
    min -= pad;
    max += pad;
  }

  let step = resolveNiceStep((max - min) / DEFAULT_TICK_STEPS);
  let niceMin = Math.floor(min / step) * step;
  let niceMax = Math.ceil(max / step) * step;
  let ticks: number[] = [];
  while (ticks.length === 0 || ticks.length > 7) {
    ticks = [];
    for (let current = niceMin; current <= niceMax + step * 0.5; current += step) {
      ticks.push(toRounded(current));
    }
    if (ticks.length > 7) {
      step *= 2;
      niceMin = Math.floor(min / step) * step;
      niceMax = Math.ceil(max / step) * step;
    }
  }

  return {
    min: toRounded(niceMin),
    max: toRounded(niceMax),
    ticks,
  };
}

function formatTick(value: number): string {
  const rounded = Math.abs(value) < 1e-6 ? 0 : value;
  if (rounded === 0) return "0%";
  return `${rounded.toFixed(1)}%`;
}

export function RechartsGaugeRenderer({
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
  const chartHeight = height ?? 420;
  const cartesianStyle = style as CartesianStyle | undefined;
  const enabledSeries = cartesianStyle?.timepointLine?.enabled ?? {};
  const palette = style?.colorPalette ?? [];

  const parsed = useMemo(() => {
    const table = toChartCoreTable(data);
    const visibleFields = table.yFields.filter((field) => enabledSeries[field] !== false);
    const latestRow = table.rows[table.rows.length - 1];

    if (!latestRow || visibleFields.length === 0) {
      return { needles: [] as GaugeNeedle[], scale: buildGaugeScale([]) };
    }

    const colorBase =
      palette.length > 0
        ? palette
        : themeColors.seriesColors.length > 0
          ? themeColors.seriesColors
          : FALLBACK_NEEDLE_COLORS;
    const expandedColors = expandSeriesColors(colorBase, visibleFields.length);
    const seriesColorMap = new Map(
      table.series.map((series) => [series.id, series.color])
    );

    const needles: GaugeNeedle[] = [];
    for (const [idx, field] of visibleFields.entries()) {
      const rawValue = latestRow[field];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
      needles.push({
        id: field,
        label: field,
        value: rawValue,
        color:
          seriesColorMap.get(field) ??
          expandedColors[idx] ??
          FALLBACK_NEEDLE_COLORS[idx % FALLBACK_NEEDLE_COLORS.length]!,
      });
    }

    // 게이지는 현재 시점 비교가 목적이므로 최신 값 기준으로 스케일을 잡는다.
    const scaleValues = needles.map((needle) => needle.value);

    return {
      needles,
      scale: buildGaugeScale(scaleValues),
    };
  }, [data, enabledSeries, palette, themeColors.seriesColors]);

  if (parsed.needles.length === 0) {
    return (
      <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />
    );
  }

  const viewWidth = 320;
  const viewHeight = 260;
  const centerX = viewWidth / 2;
  const centerY = 165;
  const radius = 100;
  const range = parsed.scale.max - parsed.scale.min || 1;

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} onMouseLeave={() => {
          onLegendStateChange?.({ tooltipPayload: null, hoveredLabel: null });
        }}>
          <path
            d={describeArc(centerX, centerY, radius, GAUGE_START_ANGLE, GAUGE_END_ANGLE)}
            fill="none"
            stroke={themeColors.axisLineColor || "rgba(255, 255, 255, 0.18)"}
            strokeWidth={ARC_STROKE_WIDTH}
            opacity={0.25}
            strokeLinecap="round"
          />

          {ARC_SEGMENT_COLORS.map((color, idx) => {
            const segmentStart = parsed.scale.min + (range * idx) / ARC_SEGMENT_COLORS.length;
            const segmentEnd = parsed.scale.min + (range * (idx + 1)) / ARC_SEGMENT_COLORS.length;
            const startAngle = toNeedleAngle(segmentStart, parsed.scale) + 0.7;
            const endAngle = toNeedleAngle(segmentEnd, parsed.scale) - 0.7;
            if (endAngle <= startAngle) return null;
            return (
              <path
                key={`${color}-${idx}`}
                d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
                fill="none"
                stroke={color}
                strokeWidth={ARC_STROKE_WIDTH}
                strokeLinecap="round"
              />
            );
          })}

          {parsed.scale.ticks.map((tickValue) => {
            const angle = toNeedleAngle(tickValue, parsed.scale);
            const tickStart = toPolarPoint(centerX, centerY, radius + 6, angle);
            const tickEnd = toPolarPoint(centerX, centerY, radius + 12, angle);
            const tickLabel = toPolarPoint(centerX, centerY, radius + 24, angle);
            return (
              <g key={`tick-${tickValue}`}>
                <line
                  x1={tickStart.x}
                  y1={tickStart.y}
                  x2={tickEnd.x}
                  y2={tickEnd.y}
                  stroke={themeColors.textColor || "#9CA3AF"}
                  strokeOpacity={0.65}
                  strokeWidth={1.1}
                />
                <text
                  x={tickLabel.x}
                  y={tickLabel.y}
                  fill={themeColors.textColor || "#D1D5DB"}
                  fontSize={12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  opacity={0.9}
                >
                  {formatTick(tickValue)}
                </text>
              </g>
            );
          })}

          {parsed.needles.map((needle, idx) => {
            const angle = toNeedleAngle(needle.value, parsed.scale);
            const needleLength = Math.max(58, radius - 12 - idx * 9);
            const needleTip = toPolarPoint(centerX, centerY, needleLength, angle);
            return (
              <g
                key={needle.id}
                onMouseEnter={() => {
                  onLegendStateChange?.({
                    tooltipPayload: [{ dataKey: needle.id, name: needle.label, value: needle.value, color: needle.color }],
                    hoveredLabel: needle.label,
                  });
                }}
              >
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={needleTip.x}
                  y2={needleTip.y}
                  stroke={needle.color}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                <circle cx={needleTip.x} cy={needleTip.y} r={2.2} fill={needle.color} />
              </g>
            );
          })}

          <circle
            cx={centerX}
            cy={centerY}
            r={8}
            fill={themeColors.axisLineColor || "#1F2937"}
            stroke={themeColors.textColor || "#D1D5DB"}
            strokeWidth={1}
          />

          {parsed.needles.slice(0, 5).map((needle, idx) => (
            <g key={`label-${needle.id}`}>
              <circle
                cx={centerX - 66}
                cy={212 + idx * 13}
                r={3}
                fill={needle.color}
              />
              <text
                x={centerX - 56}
                y={212 + idx * 13}
                fill={themeColors.textColor || "#D1D5DB"}
                fontSize={11}
                textAnchor="start"
                dominantBaseline="middle"
              >
                {needle.label}
              </text>
              <text
                x={centerX + 78}
                y={212 + idx * 13}
                fill={needle.color}
                fontSize={11}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatTick(needle.value)}
              </text>
            </g>
          ))}
        </svg>
      </ResponsiveContainer>
    </div>
  );
}
