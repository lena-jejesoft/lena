"use client";

import React from "react";
import { formatTooltipValue as formatNumericTooltip } from "@/packages/chart-lib/utils/number-formatters";

type TooltipItem = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  stroke?: string;
  value?: number | string | Array<number | string> | null;
  payload?: Record<string, unknown>;
};
type TooltipValue = TooltipItem["value"];

type ChartCoreLineTooltipContentProps = {
  active?: boolean;
  label?: React.ReactNode;
  payload?: TooltipItem[];
  seriesLabelMap?: Record<string, string>;
};

function formatTooltipValue(value: TooltipValue | null): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatTooltipValue(item)).join(", ");
  }
  if (typeof value === "number") {
    return formatNumericTooltip(value);
  }
  if (value == null) {
    return "-";
  }
  return String(value);
}

function resolveTooltipLabel(item: TooltipItem): string {
  if (typeof item.name === "string" && item.name.trim().length > 0) {
    return item.name;
  }

  if (typeof item.dataKey === "string" && item.payload) {
    const fieldKey = `${item.dataKey}_field`;
    const fieldLabel = item.payload[fieldKey];
    if (typeof fieldLabel === "string" && fieldLabel.trim().length > 0) {
      return fieldLabel;
    }
  }

  if (typeof item.dataKey === "string" && item.dataKey.trim().length > 0) {
    return item.dataKey;
  }

  return "value";
}

function resolveTooltipColor(item: TooltipItem): string {
  if (typeof item.color === "string" && item.color.length > 0) return item.color;
  if (typeof item.stroke === "string" && item.stroke.length > 0) return item.stroke;
  if (typeof item.dataKey === "string" && item.dataKey.startsWith("outlier_")) return "#ef4444";
  return "hsl(var(--foreground))";
}

export function ChartCoreLineTooltipContent({
  active,
  label,
  payload,
  seriesLabelMap,
}: ChartCoreLineTooltipContentProps) {
  const visibleItems = (payload ?? []).filter((item) => item.dataKey || item.name);

  if (!active || visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="min-w-[10rem] rounded-md border border-border/60 bg-background/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      <div className="space-y-1">
        {visibleItems.map((item, index) => (
          <div key={`${item.dataKey ?? item.name ?? "tooltip"}-${index}`} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: resolveTooltipColor(item) }}
              />
              <span className="truncate text-muted-foreground">
                {(() => {
                  const fallbackLabel = resolveTooltipLabel(item);
                  if (typeof item.dataKey === "string" && item.payload) {
                    const fieldKey = `${item.dataKey}_field`;
                    const rawField = item.payload[fieldKey];
                    if (typeof rawField === "string" && seriesLabelMap?.[rawField]) {
                      return seriesLabelMap[rawField];
                    }
                  }
                  if (typeof item.dataKey === "string" && seriesLabelMap?.[item.dataKey]) {
                    return seriesLabelMap[item.dataKey];
                  }
                  return fallbackLabel;
                })()}
              </span>
            </div>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {formatTooltipValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
