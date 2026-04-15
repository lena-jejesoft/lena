"use client";

import React, { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { RechartsRankingBarWrapper } from "./recharts-ranking-bar-wrapper";
import { getThemeColors } from "./recharts-wrapper";
import { toChartCoreTable } from "./toChartCoreTable";

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

export function ChartCoreRankingBarRenderer({
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
  const [themeColors] = useState(getThemeColors());
  
  const s = style as CartesianStyle | undefined;
  const cfg = s?.rankingBar;
  const enabled = s?.timepointLine?.enabled ?? {};
  const chartHeight = height ?? 420;

  const rawRows = useMemo(() => {
    const raw = (data.series?.[0]?.data ?? []) as unknown[];
    const rowsFromRaw = raw.filter((r): r is Row => Boolean(r) && typeof r === "object");
    const row0 = rowsFromRaw[0];

    // If input is the standard DataChart series format ({x,y} points),
    // convert all series into chartCore table rows so ranking can still render.
    if (row0 && "x" in row0 && "y" in row0) {
      return toChartCoreTable(data as any).rows as Row[];
    }

    return rowsFromRaw;
  }, [data]);

  const parsed = useMemo(() => {
    const fields = extractNumericFields(rawRows).filter((f) => enabled[f] !== false);
    const keys = rawRows.map((r, i) => pickKey(r, i));

    const negativeKeys = new Set<string>();
    keys.forEach((k, idx) => {
      if (hasAnyNegative(rawRows[idx], fields)) negativeKeys.add(k);
    });

    // Default to latest non-negative, else latest.
    const preferred = [...keys].reverse().find((k) => !negativeKeys.has(k));
    const fallback = keys[keys.length - 1] ?? "";
    const selectedKey =
      cfg?.selectedKey && keys.includes(cfg.selectedKey) ? cfg.selectedKey : (preferred ?? fallback);

    const idx = selectedKey ? keys.indexOf(selectedKey) : -1;
    const row = idx >= 0 ? rawRows[idx] : rawRows[rawRows.length - 1];

    const ranking = fields
      .map((f) => {
        const v0 = row ? row[f] : null;
        const n = typeof v0 === "number" && !Number.isNaN(v0) ? v0 : 0;
        return { name: f, value: n };
      })
      .filter((d) => typeof d.value === "number")
      .sort((a, b) => b.value - a.value);

    return { keys, negativeKeys, selectedKey, ranking };
  }, [rawRows, cfg?.selectedKey, enabled]);

  if (parsed.ranking.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsRankingBarWrapper
        data={parsed.ranking.map((item) => ({ name: item.name, value: item.value }))}
        xField="name"
        yField="value"
        height={chartHeight}
        themeColors={themeColors}
        onTooltipChange={(payload, label) => {
          setTooltipPayload(payload);
          setHoveredLabel(label);
          onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
        }}
      />
    </div>
  );
}
