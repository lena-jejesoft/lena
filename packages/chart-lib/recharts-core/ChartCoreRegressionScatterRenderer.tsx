"use client";

import React, { useMemo, useState } from "react";
import { RechartsRegressionScatterWrapper } from "./recharts-regression-scatter-wrapper";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { getThemeColors } from "./recharts-wrapper";
import { toChartCoreTable } from "./toChartCoreTable";

function toNumber(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickTimepointLabel(row: Record<string, unknown>, index: number): string {
  const fromDisplay = row.date_display;
  if (typeof fromDisplay === "string" && fromDisplay.trim().length > 0) return fromDisplay;

  const fromX = row.x;
  if (typeof fromX === "string" && fromX.trim().length > 0) return fromX;

  const fromDate = row.date;
  if (typeof fromDate === "string" && fromDate.trim().length > 0) return fromDate;

  return String(index + 1);
}

function looksLikePointArray(rows: any[]): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const r0 = rows[0];
  return r0 && typeof r0 === "object" && ("x" in r0) && ("y" in r0);
}

function pickRegressionFields(
  rawRows: Array<Record<string, unknown>>,
  preferred?: { xField?: string; yField?: string }
): { xField: string; yField: string } | null {
  if (rawRows.length === 0) return null;

  const excluded = new Set(["date", "date_display", "x", "y"]);
  const keys = Object.keys(rawRows[0]).filter((k) => !excluded.has(k));

  const numericKeys = keys.filter((k) =>
    rawRows.some((r) => typeof r[k] === "number" && !Number.isNaN(r[k] as number))
  );

  const prefX = preferred?.xField;
  const prefY = preferred?.yField;
  if (prefX && prefY && numericKeys.includes(prefX) && numericKeys.includes(prefY) && prefX !== prefY) {
    return { xField: prefX, yField: prefY };
  }
  if (prefX && numericKeys.includes(prefX)) {
    const y = (prefY && numericKeys.includes(prefY) && prefY !== prefX)
      ? prefY
      : numericKeys.find((k) => k !== prefX);
    if (y) return { xField: prefX, yField: y };
  }
  if (prefY && numericKeys.includes(prefY)) {
    const x = numericKeys.find((k) => k !== prefY);
    if (x) return { xField: x, yField: prefY };
  }

  if (numericKeys.includes("GDP") && numericKeys.includes("제조업")) {
    return { xField: "GDP", yField: "제조업" };
  }

  if (numericKeys.length >= 2) return { xField: numericKeys[0], yField: numericKeys[1] };
  return null;
}

export function ChartCoreRegressionScatterRenderer({
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
  const [themeColors, setThemeColors] = useState(getThemeColors());

  // 레전드 관련 상태
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // 회귀 산점도 상태
  const [regressionScatterXField, setRegressionScatterXField] = useState<string>("");
  const [regressionScatterYField, setRegressionScatterYField] = useState<string>("");
  const [regressionStats, setRegressionStats] = useState<{ r2: number } | null>(null);
  const [regressionOutlierCount, setRegressionOutlierCount] = useState<number>(0);

  const s = style as CartesianStyle | undefined;
  const series0 = data.series[0];
  const enabled = s?.timepointLine?.enabled ?? {};
  const seriesEnabled = series0 ? enabled[series0.id] !== false : false;
  const raw = (series0?.data ?? []) as any[];
  const regressionScatter = s?.regressionScatter;

  const parsed = useMemo(() => {
    if (!series0) {
      return {
        rows: [] as Array<Record<string, string | number | null>>,
        xField: "",
        yField: "",
      };
    }

    const isSeriesTimepointMode = looksLikePointArray(raw) && data.series.length > 1;

    if (looksLikePointArray(raw) && !isSeriesTimepointMode) {
      const rows = (raw as any[])
        .map((p, index) => {
          const x = toNumber(p?.x);
          const y = toNumber(p?.y);
          if (x == null || y == null) return null;
          const pointLabel =
            (typeof p?.date_display === "string" && p.date_display.trim().length > 0)
              ? p.date_display
              : (typeof p?.label === "string" && p.label.trim().length > 0)
              ? p.label
              : String(index + 1);
          return {
            x,
            y,
            date_display: pointLabel,
          };
        })
        .filter(Boolean) as Array<Record<string, string | number | null>>;

      return { rows, xField: "x", yField: "y" };
    }

    const rows = isSeriesTimepointMode
      ? (toChartCoreTable(data as any).rows as Array<Record<string, unknown>>)
      : (raw.filter((r) => r && typeof r === "object") as Array<Record<string, unknown>>);
    const fields = pickRegressionFields(rows, regressionScatter);
    if (!fields) {
      return {
        rows: [] as Array<Record<string, string | number | null>>,
        xField: "",
        yField: "",
      };
    }

    const normalizedRows = rows
      .map((row, index) => {
        const x = toNumber(row[fields.xField]);
        const y = toNumber(row[fields.yField]);
        if (x == null || y == null) return null;

        return {
          ...row,
          [fields.xField]: x,
          [fields.yField]: y,
          date_display: pickTimepointLabel(row, index),
        } as Record<string, string | number | null>;
      })
      .filter(Boolean) as Array<Record<string, string | number | null>>;

    return { rows: normalizedRows, xField: fields.xField, yField: fields.yField };
  }, [raw, series0, regressionScatter]);

  const chartHeight = height ?? 400;

  if (!series0 || !seriesEnabled || !parsed.xField || !parsed.yField) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsRegressionScatterWrapper
        data={parsed.rows}
        xField={parsed.xField}
        yField={parsed.yField}
        height={chartHeight}
        themeColors={themeColors}
        onRegressionStats={setRegressionStats}
        onTooltipChange={(payload, label) => {
          setTooltipPayload(payload);
          setHoveredLabel(label);
          onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
        }}
        onOutlierCount={setRegressionOutlierCount}
      />
    </div>
  );
}
