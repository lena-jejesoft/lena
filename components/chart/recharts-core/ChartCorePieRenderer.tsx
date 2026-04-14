"use client";

import React, { useMemo, useState } from "react";
import type { ChartData, ChartStyle, PieStyle, CartesianPoint } from "../types";
import { RechartsPieWrapper, type PieChartDataItem, type TimepointPieData } from "./recharts-pie-wrapper";
import { getThemeColors } from "./recharts-wrapper";
import { calculatePieDataByTimepoint } from "./recharts-adapter";
import { toChartCoreTable } from "./toChartCoreTable";

const PIE_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

type Row = Record<string, unknown>;

function pickKey(row: Row, index: number): string {
  const v = row["date_display"] ?? row["x"] ?? row["date"] ?? index;
  return typeof v === "string" ? v : String(v);
}

function extractNumericFields(rows: Row[]): string[] {
  if (rows.length === 0) return [];
  const excluded = new Set(["date", "date_display", "x", "y"]);
  const keys = Object.keys(rows[0]).filter((k) => !excluded.has(k));
  return keys.filter((k) =>
    rows.some((r) => typeof r[k] === "number" && !Number.isNaN(r[k] as number))
  );
}

function hasAnyNegative(row: Row | undefined, fields: string[]): boolean {
  if (!row) return false;
  for (const f of fields) {
    const v = row[f];
    if (typeof v === "number" && !Number.isNaN(v) && v < 0) return true;
  }
  return false;
}

export function ChartCorePieRenderer({
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
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [themeColors, setThemeColors] = useState(getThemeColors());
  const [selectedPieData, setSelectedPieData] = useState<Array<{ name: string; value: number }> | null>(null);
 
  const pieStyle = style as PieStyle | undefined;
  const cfg = pieStyle?.timepointPie;
  const palette = style?.colorPalette?.length ? style.colorPalette : PIE_COLORS;

  const series = data.series[0];
  const prepared = useMemo((): {
    data?: PieChartDataItem[];
    timepointData?: TimepointPieData[];
    enabledSeries: Set<string>;
    allSeriesFields: string[];
  } => {
    const raw = (series?.data ?? []) as unknown[];
    const first = raw[0] as any;
    const isPointMode =
      Boolean(first) &&
      typeof first === "object" &&
      ("x" in first) &&
      typeof (first as any).y === "number";
    const isSeriesTimepointMode = isPointMode && data.series.length > 1;

    if (isPointMode && !isSeriesTimepointMode) {
      const pts = raw as CartesianPoint[];
      const total = pts.reduce((acc, p) => acc + (typeof p?.y === "number" ? p.y : 0), 0);
      const items = pts.map((p, idx) => ({
        name: typeof p.x === "string" ? p.x : String(p.x),
        value: typeof p.y === "number" ? p.y : 0,
        color: p.color ?? palette[idx % palette.length],
        percent: total ? ((typeof p.y === "number" ? p.y : 0) / total) * 100 : 0,
      }));
      const allSeriesFields = items.map((d) => d.name);
      const enabled = cfg?.enabled ?? {};
      const enabledSeries = new Set<string>(
        allSeriesFields.filter((field) => enabled[field] !== false)
      );
      return {
        data: items.map(({ name, value }) => ({ name, value })),
        timepointData: undefined,
        enabledSeries,
        allSeriesFields,
      };
    }

    const rows = isSeriesTimepointMode
      ? (toChartCoreTable(data as any).rows as Row[])
      : raw.filter((r): r is Row => Boolean(r) && typeof r === "object");
    const fields = extractNumericFields(rows);
    const keys = rows.map((r, i) => pickKey(r, i));

    const negativeKeys = new Set<string>();
    keys.forEach((k, idx) => {
      if (hasAnyNegative(rows[idx], fields)) negativeKeys.add(k);
    });

    // Default to latest non-negative, else latest.
    const preferred = [...keys].reverse().find((k) => !negativeKeys.has(k));
    const fallback = keys[keys.length - 1] ?? "";
    const selectedKey =
      cfg?.selectedKey && keys.includes(cfg.selectedKey) && !negativeKeys.has(cfg.selectedKey)
        ? cfg.selectedKey
        : (preferred ?? fallback);

    const idx = selectedKey ? keys.indexOf(selectedKey) : -1;
    const row = idx >= 0 ? rows[idx] : rows[rows.length - 1];

    const enabled = cfg?.enabled ?? {};
    const visibleFields = fields.filter((f) => enabled[f] !== false);

    const enabledSeries = new Set<string>(visibleFields);

    const singleData = visibleFields
      .map((f) => {
        const v0 = row ? (row as any)[f] : null;
        const nRaw = typeof v0 === "number" && !Number.isNaN(v0) ? v0 : 0;
        const n = nRaw < 0 ? 0 : nRaw;
        return { name: f, value: n };
      })
      .filter((d) => d.value > 0);

    const pieChartData = visibleFields
      .map((f) => {
        let sum = 0;
        for (const r of rows) {
          const v = r[f];
          if (typeof v === "number" && !Number.isNaN(v)) {
            sum += v;
          }
        }
        return { name: f, value: sum };
      })
      .filter((d) => d.value > 0);

    const rowModeChartData = rows.map((r, i) => {
      const output: Record<string, unknown> = {
        date: typeof r["date"] === "string" ? r["date"] : keys[i],
        date_display: keys[i],
      };
      for (const f of visibleFields) {
        const v = r[f];
        output[f] = typeof v === "number" && !Number.isNaN(v) ? v : 0;
      }
      return output;
    });

    const pieChartTimepointData =
      rowModeChartData.length > 0 && visibleFields.length > 0
        ? calculatePieDataByTimepoint(rowModeChartData as any[], visibleFields)
        : [];

    return {
      data: pieChartData.length > 0 ? pieChartData : singleData,
      timepointData: pieChartTimepointData,
      enabledSeries,
      allSeriesFields: fields,
    };
  }, [series, palette, cfg]);

  const chartHeight = height ?? 400;
  const showLabels = pieStyle?.dataLabels !== false;

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsPieWrapper
        data={prepared.data}
        enabledSeries={prepared.enabledSeries}
        allSeriesFields={prepared.allSeriesFields}
        themeColors={{
          ...themeColors,
          seriesColors: palette.length > 0 ? palette : themeColors.seriesColors,
        }}
        height={chartHeight}
        showDefaultLabels={showLabels}
        timepointData={prepared.timepointData}
        onTooltipChange={(payload, label) => {
          setTooltipPayload(payload);
          setHoveredLabel(label);
          onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
        }}
        onSelectedDataChange={setSelectedPieData}
      />
    </div>
  );
}
