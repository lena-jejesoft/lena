"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type {
  CartesianPoint,
  ChartCoreLegendMeta,
  ChartData,
  ChartStyle,
  ChartType,
} from "../types";

const ChartToolView = dynamic(
  () => import("@chartCore/src/tools/chartTool/index"),
  { ssr: false }
);

type ChartCoreInputRow = Record<string, string | number> & {
  date: string;
  date_display: string;
};

type PivotRowMeta = {
  row: ChartCoreInputRow;
  sortValue: number;
  order: number;
};

type ChartCoreFieldMeta = {
  label: string;
  unit?: string;
};

function isCartesianPoint(point: unknown): point is CartesianPoint {
  if (!point || typeof point !== "object") return false;
  if (!("x" in point) || !("y" in point)) return false;
  return typeof (point as CartesianPoint).y === "number";
}

function isRowObjectMode(data: ChartData): boolean {
  if (data.series.length !== 1) return false;
  const first = (data.series[0]?.data ?? [])[0] as unknown;
  if (!first || typeof first !== "object" || Array.isArray(first)) return false;
  if ("x" in (first as Record<string, unknown>) && "y" in (first as Record<string, unknown>)) return false;
  return true;
}

function extractNumericFields(rows: Array<Record<string, unknown>>): string[] {
  const excluded = new Set(["date", "date_display", "x", "y"]);
  const allKeys = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!excluded.has(key)) allKeys.add(key);
    });
  });

  return Array.from(allKeys).filter((field) =>
    rows.some((row) => {
      const value = row[field];
      return typeof value === "number" && Number.isFinite(value);
    })
  );
}

function toDateAndDisplayFromX(
  x: string | number,
  xAxisType: ChartData["xAxisType"]
): { date: string; dateDisplay: string; sortValue: number } {
  if (xAxisType === "datetime") {
    if (typeof x === "number" && Number.isFinite(x)) {
      const iso = new Date(x).toISOString();
      return {
        date: iso,
        dateDisplay: iso.slice(0, 10),
        sortValue: x,
      };
    }

    const parsed = Date.parse(String(x));
    if (Number.isFinite(parsed)) {
      return {
        date: new Date(parsed).toISOString(),
        dateDisplay: String(x),
        sortValue: parsed,
      };
    }
  }

  if (xAxisType === "numeric") {
    const numeric = typeof x === "number" ? x : Number(x);
    return {
      date: String(x),
      dateDisplay: String(x),
      sortValue: Number.isFinite(numeric) ? numeric : Number.NaN,
    };
  }

  return {
    date: String(x),
    dateDisplay: String(x),
    sortValue: Number.NaN,
  };
}

function normalizeRowObjectData(data: ChartData): ChartCoreInputRow[] {
  const rawRows = ((data.series[0]?.data ?? []) as unknown[]).filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row)
  );
  const numericFields = extractNumericFields(rawRows);

  return rawRows.map((row, index) => {
    const dateDisplayRaw = row.date_display ?? row.x ?? row.date ?? index;
    const dateRaw = row.date ?? row.date_display ?? row.x ?? index;

    const normalizedRow: ChartCoreInputRow = {
      date: String(dateRaw),
      date_display: String(dateDisplayRaw),
    };

    numericFields.forEach((field) => {
      const value = row[field];
      normalizedRow[field] = typeof value === "number" && Number.isFinite(value) ? value : 0;
    });

    return normalizedRow;
  });
}

function normalizePointData(data: ChartData): ChartCoreInputRow[] {
  const rowsByKey = new Map<string, PivotRowMeta>();
  const yFields = data.series.map((series) => series.id);
  let order = 0;

  data.series.forEach((series) => {
    (series.data as unknown[]).forEach((point) => {
      if (!isCartesianPoint(point)) return;

      const key = `${typeof point.x}:${String(point.x)}`;
      const base = toDateAndDisplayFromX(point.x, data.xAxisType);

      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          row: {
            date: base.date,
            date_display: base.dateDisplay,
          },
          sortValue: base.sortValue,
          order: order++,
        });
      }

      const current = rowsByKey.get(key);
      if (!current) return;
      current.row[series.id] = point.y;
    });
  });

  const normalized = Array.from(rowsByKey.values()).map((meta) => {
    yFields.forEach((field) => {
      if (!(field in meta.row)) meta.row[field] = 0;
    });
    return meta;
  });

  if (data.xAxisType === "datetime" || data.xAxisType === "numeric") {
    normalized.sort((a, b) => {
      const aValid = Number.isFinite(a.sortValue);
      const bValid = Number.isFinite(b.sortValue);
      if (aValid && bValid) return a.sortValue - b.sortValue;
      if (aValid) return -1;
      if (bValid) return 1;
      return a.order - b.order;
    });
  } else {
    normalized.sort((a, b) => a.order - b.order);
  }

  return normalized.map((meta) => meta.row);
}

function toChartCoreInputRows(data: ChartData): ChartCoreInputRow[] {
  if (isRowObjectMode(data)) {
    return normalizeRowObjectData(data);
  }
  return normalizePointData(data);
}

function toChartCoreType(
  chartType: ChartType
): "line" | "column" | "stacked" | "stacked-100" | "stacked-grouped" | "dual-axis" | "dual-axis-stacked-bar" | "mixed" | "area" | "area-100" | "stacked-area" | "synced-area" | "pie" | "two-level-pie" | "treemap" | "multi-level-treemap" | "ranking-bar" | "geo-grid" | "regression-scatter" | null {
  if (chartType === "chartCore/line") return "line";
  if (chartType === "chartCore/column") return "column";
  if (chartType === "chartCore/stacked") return "stacked";
  if (chartType === "chartCore/stacked-100") return "stacked-100";
  if (chartType === "chartCore/stacked-grouped") return "stacked-grouped";
  if (chartType === "chartCore/dual-axis") return "dual-axis";
  if (chartType === "chartCore/dual-axis-stacked-bar") return "dual-axis-stacked-bar";
  if (chartType === "chartCore/mixed") return "mixed";
  if (chartType === "chartCore/area") return "area";
  if (chartType === "chartCore/area-100") return "area-100";
  if (chartType === "chartCore/stacked-area") return "stacked-area";
  if (chartType === "chartCore/synced-area") return "synced-area";
  if (chartType === "chartCore/pie") return "pie";
  if (chartType === "chartCore/two-level-pie") return "two-level-pie";
  if (chartType === "chartCore/treemap") return "treemap";
  if (chartType === "chartCore/multi-level-treemap") return "multi-level-treemap";
  if (chartType === "chartCore/ranking-bar") return "ranking-bar";
  if (chartType === "chartCore/geo-grid") return "geo-grid";
  if (chartType === "chartCore/regression-scatter") return "regression-scatter";
  return null;
}

interface ChartCoreRendererProps {
  data: ChartData;
  chartType: ChartType;
  style?: ChartStyle;
  height?: number;
  hideChartCoreLegendPanel?: boolean;
  chartCoreLegendContainer?: HTMLElement | null;
  chartCoreSeriesColorOverrides?: Record<string, string>;
  chartCoreGroupColorOverrides?: Record<string, string>;
  onChartCoreLegendMetaChange?: (meta: ChartCoreLegendMeta | null) => void;
}

const defaultDualAxisReferenceLineStyle = {
  stroke: "hsl(var(--muted-foreground))",
  strokeDasharray: "3 3",      // 점선
  strokeWidth: 1,
  opacity: 0.5,
};

export function ChartCoreRenderer({
  data,
  chartType,
  style,
  height,
  hideChartCoreLegendPanel,
  chartCoreLegendContainer,
  chartCoreSeriesColorOverrides,
  chartCoreGroupColorOverrides,
  onChartCoreLegendMetaChange,
}: ChartCoreRendererProps) {
  const resolvedChartType = toChartCoreType(chartType);
  const resolvedShowOutliers = style?.chartCore?.showOutliers ?? true;
  const resolvedShowMissingValues = style?.chartCore?.showMissingValues ?? false;
  const resolvedShowTooltip = style?.tooltip?.shared !== false;
  const inputData = useMemo(() => {
    const rows = toChartCoreInputRows(data);
    return JSON.stringify(rows, null, 2);
  }, [data]);
  const fieldMetaById = useMemo<Record<string, ChartCoreFieldMeta> | undefined>(() => {
    if (data.series.length === 0) return undefined;

    const entries = data.series
      .map((series) => {
        const label = String(series.name ?? "").trim() || series.id;
        const unit = String(series.unit ?? "").trim() || undefined;
        return [series.id, { label, unit }] as const;
      })
      .filter((entry) => Boolean(entry[0]));

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }, [data.series]);
  const dualAxisStyle = defaultDualAxisReferenceLineStyle;

  if (!resolvedChartType) {
    return (
      <div className="flex-1 min-w-0 p-2 text-xs text-muted-foreground">
        지원하지 않는 ChartCore 차트 유형입니다.
      </div>
    );
  }

  // const defaultUnitSettings: UnitSettings = {
  //   datetime_type: "quarter",
  //   datetime_range: {
  //     datetime_start: sampleData[0].date,
  //     datetime_end: sampleData[sampleData.length - 1].date,
  //   },
  //   datetime_unit: 1,
  // };

  // const unitSettings = useMemo(() => {
  //   try {
  //     const data = JSON.parse(inputData);
  //     if (!data.length) return defaultUnitSettings;

  //     const firstDisplay = data[0].date_display || "";
  //     const isDaily = /^\d{4}-\d{2}-\d{2}$/.test(firstDisplay);
  //     const isMonthly = /^\d{4}-\d{2}$/.test(firstDisplay);

  //     // 실제 min/max 날짜 계산 (데이터 순서와 무관)
  //     const dates = data.map((d: { date: string }) => new Date(d.date).getTime());
  //     const minDate = new Date(Math.min(...dates)).toISOString();
  //     const maxDate = new Date(Math.max(...dates)).toISOString();

  //     return {
  //       datetime_type: isDaily ? "day" : isMonthly ? "month" : "quarter",
  //       datetime_range: {
  //         datetime_start: minDate,
  //         datetime_end: maxDate,
  //       },
  //       datetime_unit: 1,
  //     } as UnitSettings;
  //   } catch {
  //     return defaultUnitSettings;
  //   }
  // }, [inputData]);


  return (
    <div
      className="chart-core-scope flex-1 min-w-0 w-full p-2"
      style={height ? { minHeight: height } : undefined}
    >
      <ChartToolView
        inputData={inputData}
        chartType={resolvedChartType}
        fieldMetaById={fieldMetaById}
        // unitSettings={unitSettings}
        hideToolbar={true}
        devMode={false}
        isExecuted={true}
        showBrush={true}
        showOutliers={resolvedShowOutliers}
        showMissingValues={resolvedShowMissingValues}
        showTooltip={resolvedShowTooltip}
        showDualAxisReferenceLine={true}
        dualAxisReferenceLineStyle={dualAxisStyle}
        hideLegendPanel={hideChartCoreLegendPanel}
        externalLegendContainer={chartCoreLegendContainer}
        seriesColorOverrides={chartCoreSeriesColorOverrides}
        groupColorOverrides={chartCoreGroupColorOverrides}
        onLegendMetaChange={onChartCoreLegendMetaChange}
      />
    </div>
  );
}
