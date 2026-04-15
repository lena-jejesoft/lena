"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";

const DUAL_AXIS_STACKED_BAR_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

function defaultSplitAssignments(fields: string[]): Record<string, number> {
  const next: Record<string, number> = {};
  if (fields.length === 0) return next;
  const split = Math.ceil(fields.length / 2);
  fields.forEach((field, idx) => {
    next[field] = idx < split ? 1 : 2;
  });
  return next;
}

function inferDepartmentGroup(field: string): number | null {
  const prefix = field.split("_")[0]?.toLowerCase() ?? "";
  if (prefix === "dx") return 1;
  if (prefix === "ds") return 2;
  if (prefix === "sdc") return 3;
  if (prefix === "harman") return 4;
  return null;
}

function buildDefaultDepartmentAssignments(fields: string[]): Record<string, number> {
  const inferred: Record<string, number> = {};
  const fallback = defaultSplitAssignments(fields);

  fields.forEach((field) => {
    const departmentGroup = inferDepartmentGroup(field);
    inferred[field] = departmentGroup ?? fallback[field] ?? 1;
  });

  return inferred;
}

function normalizeAssignments(
  fields: string[],
  styleAssignments?: Record<string, number>
): Record<string, number> {
  const defaults = buildDefaultDepartmentAssignments(fields);
  const next: Record<string, number> = {};

  fields.forEach((field) => {
    const raw = styleAssignments?.[field];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      next[field] = Math.max(0, Math.min(4, Math.floor(raw)));
      return;
    }
    next[field] = defaults[field] ?? 1;
  });

  return next;
}

function inferYAxisPlacements(
  rows: Array<Record<string, string | number | null>>,
  fields: string[]
): Record<string, "left" | "right"> {
  const maxAbsByField: Record<string, number> = {};
  fields.forEach((field) => {
    maxAbsByField[field] = 0;
  });

  rows.forEach((row) => {
    fields.forEach((field) => {
      const value = row[field];
      if (typeof value !== "number" || Number.isNaN(value)) return;
      maxAbsByField[field] = Math.max(maxAbsByField[field] ?? 0, Math.abs(value));
    });
  });

  const nonZero = fields
    .map((field) => maxAbsByField[field] ?? 0)
    .filter((value) => value > 0)
    .sort((a, b) => b - a);

  if (nonZero.length <= 1) {
    return fields.reduce<Record<string, "left" | "right">>((acc, field) => {
      acc[field] = "left";
      return acc;
    }, {});
  }

  const largest = nonZero[0] ?? 0;
  const smallest = nonZero[nonZero.length - 1] ?? 0;
  const ratio = smallest > 0 ? largest / smallest : Infinity;

  if (ratio < 20) {
    return fields.reduce<Record<string, "left" | "right">>((acc, field) => {
      acc[field] = "left";
      return acc;
    }, {});
  }

  const threshold = largest / 20;
  const next: Record<string, "left" | "right"> = {};
  fields.forEach((field) => {
    const maxAbs = maxAbsByField[field] ?? 0;
    next[field] = maxAbs > 0 && maxAbs <= threshold ? "right" : "left";
  });

  const hasLeft = fields.some((field) => next[field] === "left");
  const hasRight = fields.some((field) => next[field] === "right");
  if (!hasLeft || !hasRight) {
    const sortedBySize = [...fields].sort(
      (a, b) => (maxAbsByField[a] ?? 0) - (maxAbsByField[b] ?? 0)
    );
    const smallestField = sortedBySize[0];
    if (smallestField) next[smallestField] = "right";
  }

  return next;
}

export function ChartCoreDualAxisStackedBarRenderer({
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
  const s = style as CartesianStyle | undefined;
  const palette = style?.colorPalette?.length ? style.colorPalette : DUAL_AXIS_STACKED_BAR_COLORS;

  const base = useMemo(() => toChartCoreTable(data), [data]);

  const seriesGroupAssignments = useMemo(
    () => normalizeAssignments(base.yFields, s?.stackedGrouped?.assignments),
    [base.yFields, s?.stackedGrouped?.assignments]
  );

  const effectiveYFieldTypes = useMemo(() => {
    const styleTypes = (s?.dualAxis?.yFieldTypes ?? {}) as Record<string, string>;
    const next: Record<string, "column" | "line"> = {};
    base.yFields.forEach((field) => {
      const type = styleTypes[field];
      next[field] = type === "line" ? "line" : "column";
    });
    return next;
  }, [base.yFields, s?.dualAxis?.yFieldTypes]);

  const visibleYFields = useMemo(() => {
    const enabledMap = s?.timepointLine?.enabled ?? {};
    const styleTypes = (s?.dualAxis?.yFieldTypes ?? {}) as Record<string, string>;
    const fields = base.yFields.filter((field) => {
      if (enabledMap[field] === false) return false;
      if ((seriesGroupAssignments[field] ?? 0) <= 0) return false;
      if (styleTypes[field] === "none") return false;
      return true;
    });
    return fields.length > 0 ? fields : base.yFields;
  }, [base.yFields, s?.timepointLine?.enabled, s?.dualAxis?.yFieldTypes, seriesGroupAssignments]);

  const normalizedRows = useMemo(() => {
    return (base.rows as Array<Record<string, string | number | null>>).map((row, idx) => {
      const rawX = row[base.xField] ?? row.x ?? idx;
      const label = typeof rawX === "string" ? rawX : String(rawX);
      return {
        ...row,
        date_display: typeof row.date_display === "string" ? row.date_display : label,
      };
    });
  }, [base.rows, base.xField]);

  const yAxisPlacements = useMemo(() => {
    const inferred = inferYAxisPlacements(normalizedRows, visibleYFields);
    const stylePlacements = s?.dualAxis?.placements ?? {};
    visibleYFields.forEach((field) => {
      const placement = stylePlacements[field];
      if (placement === "left" || placement === "right") {
        inferred[field] = placement;
      }
    });
    return inferred;
  }, [normalizedRows, visibleYFields, s?.dualAxis?.placements]);

  const chartHeight = height ?? 400;
  if (visibleYFields.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsWrapper
        data={normalizedRows}
        xField={base.xField}
        yFields={visibleYFields}
        allSeriesFields={base.yFields}
        chartType="dual-axis-stacked-bar"
        themeColors={themeColors}
        colors={palette}
        height={chartHeight}
        yFieldTypes={effectiveYFieldTypes}
        yAxisPlacements={yAxisPlacements}
        seriesGroupAssignments={seriesGroupAssignments}
        showOutliers={false}
        showBrush={true}
        onTooltipChange={(payload, label) => {
          onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
        }}
      />
    </div>
  );
}
