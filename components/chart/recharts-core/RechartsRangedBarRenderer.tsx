"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CartesianPoint, ChartData, ChartStyle } from "../types";

export interface WaterfallStep {
  label: string;
  value: number;
  isTotal?: boolean;
}

interface WaterfallRow {
  label: string;
  valueRange: [number, number];
  end: number;
  delta: number;
  kind: "start" | "increase" | "decrease" | "total";
  displayLabel: string;
}

interface RechartsRangedBarRendererProps {
  data?: ChartData;
  style?: ChartStyle;
  steps?: WaterfallStep[];
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
  startColor?: string;
  totalColor?: string;
}

interface BridgeTooltipProps {
  active?: boolean;
  payload?: Array<{ color?: string; payload?: WaterfallRow }>;
}

const DEFAULT_STEPS: WaterfallStep[] = [
  { label: "기준 가치", value: 120, isTotal: true },
  { label: "제품 믹스", value: 35 },
  { label: "원가 개선", value: 22 },
  { label: "환율 영향", value: -18 },
  { label: "기타", value: -9 },
  { label: "전환 가치", value: 150, isTotal: true },
];

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const trim = (v: string) => v.replace(/\.?0+$/, "");
  if (abs >= 1_000_000_000) return `${trim((abs / 1_000_000_000).toFixed(2))}B`;
  if (abs >= 1_000_000) return `${trim((abs / 1_000_000).toFixed(2))}M`;
  if (abs >= 1_000) return `${trim((abs / 1_000).toFixed(2))}K`;
  if (abs >= 10) return trim(abs.toFixed(1));
  return trim(abs.toFixed(2));
}

function formatValueLabel(value: number): string {
  return formatCompact(value);
}

function formatSignedValue(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${sign}${formatCompact(Math.abs(value))}`;
}

function toWaterfallRows(steps: WaterfallStep[]): WaterfallRow[] {
  const rows: WaterfallRow[] = [];
  let running = 0;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const isStart = i === 0 && step.isTotal;
    const isTotal = !isStart && Boolean(step.isTotal);

    // 합계 막대는 0에서 시작하고, 일반 막대는 직전 누적값에서 시작한다.
    const start = step.isTotal ? 0 : running;
    const end = step.isTotal ? step.value : running + step.value;
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    const delta = end - start;

    const kind: WaterfallRow["kind"] = isStart
      ? "start"
      : isTotal
        ? "total"
        : delta >= 0
          ? "increase"
          : "decrease";

    const signedLabel = kind === "increase" || kind === "decrease"
      ? `${delta < 0 ? "-" : ""}${formatValueLabel(delta)}`
      : formatValueLabel(end);

    rows.push({
      label: step.label,
      valueRange: [low, high],
      end,
      delta,
      kind,
      displayLabel: signedLabel,
    });

    running = end;
  }

  return rows;
}

function toPointValue(point: unknown): number | null {
  if (!point || typeof point !== "object") return null;
  const maybe = point as Partial<CartesianPoint>;
  return typeof maybe.y === "number" && !Number.isNaN(maybe.y) ? maybe.y : null;
}

function extractStepsFromChartData(data?: ChartData): WaterfallStep[] | null {
  if (!data || !Array.isArray(data.series) || data.series.length === 0) return null;

  const seriesValues = data.series
    .map((series) => {
      const points = Array.isArray(series.data) ? [...series.data] : [];
      for (let i = points.length - 1; i >= 0; i -= 1) {
        const value = toPointValue(points[i]);
        if (value != null) {
          return { label: series.name || series.id, value };
        }
      }
      return null;
    })
    .filter((item): item is { label: string; value: number } => item != null);

  if (seriesValues.length === 0) return null;
  if (seriesValues.length === 1) {
    return [{ label: seriesValues[0].label, value: seriesValues[0].value, isTotal: true }];
  }

  // 첫 항목을 기준값으로 두고, 나머지 항목을 전환 요인으로 사용한다.
  const [first, ...deltas] = seriesValues;
  const total = seriesValues.reduce((sum, item) => sum + item.value, 0);

  return [
    { label: first.label, value: first.value, isTotal: true },
    ...deltas.map((item) => ({ label: item.label, value: item.value })),
    { label: "합계", value: total, isTotal: true },
  ];
}

function BridgeTooltip({ active, payload }: BridgeTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const row = item?.payload;
  if (!row) return null;

  const valueText =
    row.kind === "start" || row.kind === "total"
      ? formatCompact(row.end)
      : formatSignedValue(row.delta);

  return (
    <div
      className="pointer-events-none"
      style={{
        background: "rgba(30,30,30,0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 11,
        color: "#ddd",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{row.label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: item?.color ?? "#999",
            display: "inline-block",
          }}
        />
        <span>
          {valueText}
          <span style={{ color: "rgba(255,255,255,0.6)" }}> · 변동</span>
        </span>
      </div>
    </div>
  );
}

export function RechartsRangedBarRenderer({
  data,
  style,
  steps = DEFAULT_STEPS,
  height = 360,
  positiveColor = "#37c786",
  negativeColor = "#ef4444",
  startColor = "#6bc9bf",
  totalColor = "#b84a8f",
}: RechartsRangedBarRendererProps) {
  const sourceSteps = useMemo(() => {
    const fromData = extractStepsFromChartData(data);
    return fromData ?? steps;
  }, [data, steps]);

  const palette = style?.colorPalette ?? [];
  const resolvedPositiveColor = palette[0] ?? positiveColor;
  const resolvedNegativeColor = palette[1] ?? negativeColor;
  const resolvedStartColor = palette[2] ?? startColor;
  const resolvedTotalColor = palette[3] ?? totalColor;

  const rows = useMemo(() => toWaterfallRows(sourceSteps), [sourceSteps]);
  const yDomain = useMemo<[number, number]>(() => {
    if (rows.length === 0) return [0, 1];
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const [low, high] = row.valueRange;
      if (low < min) min = low;
      if (high > max) max = high;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) return [min - 1, max + 1];

    // 라벨이 잘리지 않도록 상단 헤드룸을 추가한다.
    const span = max - min;
    const topPadding = Math.max(span * 0.15, 1);
    return [Math.min(min, 0), max + topPadding];
  }, [rows]);
  const foregroundColor = "hsl(var(--foreground))";
  const mutedForegroundColor = "hsl(var(--muted-foreground))";
  const borderColor = "hsl(var(--border))";

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 30, right: 16, bottom: 8, left: 10 }}
          barCategoryGap="10%"
        >
          <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.18)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: borderColor }}
            tick={{ fill: foregroundColor, fontSize: 12 }}
            interval={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: mutedForegroundColor, fontSize: 11 }}
            domain={yDomain}
            tickFormatter={(v) => formatCompact(Number(v))}
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
            content={<BridgeTooltip />}
          />

          <Bar dataKey="valueRange" radius={[2, 2, 0, 0]}>
            {rows.map((row, idx) => {
              const fill = row.kind === "decrease"
                ? resolvedNegativeColor
                : row.kind === "increase"
                  ? resolvedPositiveColor
                  : row.kind === "start"
                    ? resolvedStartColor
                    : resolvedTotalColor;

              return <Cell key={`${row.label}-${idx}`} fill={fill} />;
            })}
            <LabelList
              dataKey="displayLabel"
              position="top"
              fontSize={12}
              fontWeight={600}
              fill={foregroundColor}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
