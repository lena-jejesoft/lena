"use client";

import { useState, useCallback } from "react";
import type { ChartType, ChartStyle, ChartData, CartesianStyle } from "@/packages/chart-lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { setChartTheme } from "@/packages/chart-lib/recharts-core/recharts-wrapper";
import type { ChartType as LegendChartType } from "@/packages/chart-lib/recharts-core/recharts-type";
import { AlertTriangle, CircleDot } from "lucide-react";
import { CHART_TYPE_OPTIONS } from "@/packages/chart-lib/chart-type-options";
import ChartBlockCardBody from "./chart-block-card-body";

interface ChartBlock {
  id: number;
  title: string;
  chartType: ChartType;
  style: ChartStyle;
  data: ChartData;
  collapsed: boolean;
}

type LegendControlProps = {
  onLegendChartTypeChange: (type: LegendChartType) => void;
  legendTheme: "light" | "dark";
  onLegendThemeChange: (theme: "light" | "dark") => void;
};

function toRechartsChartType(type: LegendChartType): ChartType {
  return `recharts/${type}` as ChartType;
}

const OUTLIER_UNSUPPORTED_CORE_TYPES = new Set<string>([
  "stacked",
  "stacked-100",
  "stacked-grouped",
  "dual-axis-stacked-bar",
  "area",
  "area-100",
  "stacked-area",
  "synced-area",
  "pie",
  "two-level-pie",
  "treemap",
  "multi-level-treemap",
  "ranking-bar",
  "geo-grid",
  "regression-scatter",
]);
const MISSING_UNSUPPORTED_CORE_TYPES = new Set<string>([
  "pie",
  "two-level-pie",
  "treemap",
  "multi-level-treemap",
  "ranking-bar",
  "stacked-area",
  "synced-area",
  "geo-grid",
  "regression-scatter",
]);

// ─── ChartBlockCard ───

export function ChartBlockCard({
  block,
  isActive,
  onActivate,
  onToggleCollapse,
  onTitleChange,
  onChartTypeChange,
  onStyleChange,
}: {
  block: ChartBlock;
  isActive: boolean;
  onActivate: () => void;
  onToggleCollapse: () => void;
  onTitleChange: (title: string) => void;
  onChartTypeChange: (type: ChartType) => void;
  onStyleChange: (style: ChartStyle) => void;
}) {
  const [coreLegendState, setCoreLegendState] = useState<{
    tooltipPayload: any[] | null;
    hoveredLabel: string | null;
    treemapStats?: any;
  }>({
    tooltipPayload: null,
    hoveredLabel: null,
    treemapStats: null,
  });
  const [legendTheme, setLegendTheme] = useState<"light" | "dark">("light");

  const handleLegendChartTypeChange = useCallback(
    (type: LegendChartType) => {
      onChartTypeChange(toRechartsChartType(type));
    },
    [onChartTypeChange]
  );

  const handleLegendThemeChange = useCallback((theme: "light" | "dark") => {
    setLegendTheme(theme);
    setChartTheme(theme);
  }, []);

  const legendControlProps: LegendControlProps = {
    onLegendChartTypeChange: handleLegendChartTypeChange,
    legendTheme,
    onLegendThemeChange: handleLegendThemeChange,
  };
  const handleLegendStateChange = useCallback(
    (state: { tooltipPayload: any[] | null; hoveredLabel: string | null; treemapStats?: any }) => {
      if (
        block.chartType !== "recharts/line" &&
        block.chartType !== "recharts/column" &&
        block.chartType !== "recharts/area" &&
        block.chartType !== "recharts/area-100" &&
        block.chartType !== "recharts/stacked" &&
        block.chartType !== "recharts/stacked-100" &&
        block.chartType !== "recharts/stacked-area" &&
        block.chartType !== "recharts/ownership-stacked" &&
        block.chartType !== "recharts/gauge" &&
        block.chartType !== "recharts/value-conversion-bridge" &&
        block.chartType !== "recharts/synced-area" &&
        block.chartType !== "recharts/mixed" &&
        block.chartType !== "recharts/dual-axis" &&
        block.chartType !== "recharts/dual-axis-stacked-bar" &&
        block.chartType !== "recharts/geo-grid" &&
        block.chartType !== "recharts/ranking-bar" &&
        block.chartType !== "recharts/regression-scatter" &&
        block.chartType !== "recharts/radar" &&
        block.chartType !== "recharts/pie" &&
        block.chartType !== "recharts/two-level-pie" &&
        block.chartType !== "recharts/stacked-grouped" &&
        block.chartType !== "recharts/treemap" &&
        block.chartType !== "recharts/multi-level-treemap"
      ) {
        return;
      }

      const nextTooltipPayload = state.tooltipPayload ?? null;
      const nextHoveredLabel = state.hoveredLabel ?? null;
      const nextTreemapStats = state.treemapStats ?? null;

      setCoreLegendState((prev) => {
        if (
          prev.tooltipPayload === nextTooltipPayload &&
          prev.hoveredLabel === nextHoveredLabel &&
          prev.treemapStats === nextTreemapStats
        ) {
          return prev;
        }
        return {
          tooltipPayload: nextTooltipPayload,
          hoveredLabel: nextHoveredLabel,
          treemapStats: nextTreemapStats,
        };
      });
    },
    [block.chartType]
  );
  const blockLightweightScenario =
    (block.style as CartesianStyle | undefined)?.lightweightCandles?.scenario ?? "BASE";
  const isChartCoreBlock = String(block.chartType).startsWith("chartCore/");
  const chartCoreOptions = block.style.chartCore;
  const chartCoreOutliers = chartCoreOptions?.showOutliers ?? true;
  const chartCoreMissingValues = chartCoreOptions?.showMissingValues ?? false;
  const chartCoreType = String(block.chartType).replace(/^chartCore\//, "");
  const outlierDisabled = OUTLIER_UNSUPPORTED_CORE_TYPES.has(chartCoreType);
  const missingDisabled = MISSING_UNSUPPORTED_CORE_TYPES.has(chartCoreType);

  const handleChartCoreOutliersChange = (next: boolean) => {
    onStyleChange({
      ...block.style,
      chartCore: {
        ...(block.style.chartCore ?? {}),
        showOutliers: next,
      },
    });
  };

  const handleChartCoreMissingChange = (next: boolean) => {
    onStyleChange({
      ...block.style,
      chartCore: {
        ...(block.style.chartCore ?? {}),
        showMissingValues: next,
      },
    });
  };

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden shrink-0 transition-all",
        isActive ? "border-primary bg-card" : "border-border bg-card",
      )}
      onClick={onActivate}
    >
      {/* Block header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <Input
          type="text"
          value={block.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="flex-1 bg-transparent border-none text-[13px] font-medium h-auto py-0 min-w-0"
          placeholder="차트 제목"
          onClick={(e) => e.stopPropagation()}
        />

        {isChartCoreBlock && (
          <div className="w-[180px]" onClick={(e) => e.stopPropagation()}>
            <Select value={block.chartType} onValueChange={(v) => onChartTypeChange(v as ChartType)}>
              <SelectTrigger size="sm" className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {isChartCoreBlock && (
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant={chartCoreOutliers ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleChartCoreOutliersChange(!chartCoreOutliers);
              }}
              title="이상치 표시"
              disabled={outlierDisabled}
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
            <Button
              variant={chartCoreMissingValues ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleChartCoreMissingChange(!chartCoreMissingValues);
              }}
              title="결측치 표시"
              disabled={missingDisabled}
            >
              <CircleDot className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            title={block.collapsed ? "펼치기" : "접기"}
          >
            {block.collapsed ? "▶" : "▼"}
          </Button>
        </div>
      </div>

      {/* Block body: sidebar + chart */}
      {!block.collapsed && (
        <div className="flex flex-row w-full" style={{ minHeight: 300 }}>
          <div className="flex-1 min-w-0 w-full">
            <ChartBlockCardBody />
          </div>
        </div>
      )}
    </div>
  );
}
