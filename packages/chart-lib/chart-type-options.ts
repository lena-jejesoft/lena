import type { ChartType } from "@/packages/chart-lib/types";
import type { ChartTypeIconKey } from "./chart-type-icon";

export type ChartTypeOption = {
  value: ChartType;
  label: string;
  iconKey: ChartTypeIconKey;
};

export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: "chartCore/line", label: "Line", iconKey: "line" },
  { value: "chartCore/column", label: "Column", iconKey: "column" },
  { value: "chartCore/stacked", label: "Stacked Column", iconKey: "stacked-column" },
  { value: "chartCore/stacked-100", label: "Stacked Column 100%", iconKey: "stacked-column-100" },
  { value: "chartCore/stacked-grouped", label: "Grouped Stacked Column", iconKey: "stacked-column" },
  { value: "chartCore/dual-axis", label: "Dual Axis", iconKey: "dual-axis" },
  { value: "chartCore/dual-axis-stacked-bar", label: "Dual Axis Stacked Bar", iconKey: "dual-axis-stacked-bar" },
  { value: "chartCore/mixed", label: "Mixed", iconKey: "mixed" },
  { value: "chartCore/area", label: "Area", iconKey: "area" },
  { value: "chartCore/area-100", label: "Area 100%", iconKey: "area-100" },
  { value: "chartCore/stacked-area", label: "Stacked Area", iconKey: "stacked-area" },
  { value: "chartCore/synced-area", label: "Synced Area", iconKey: "stacked-area" },
  { value: "chartCore/pie", label: "Pie", iconKey: "pie" },
  { value: "chartCore/two-level-pie", label: "Two-Level Pie", iconKey: "two-level-pie" },
  { value: "chartCore/treemap", label: "Treemap", iconKey: "treemap" },
  { value: "chartCore/multi-level-treemap", label: "Multi-Level Treemap", iconKey: "treemap" },
  { value: "chartCore/ranking-bar", label: "Ranking Bar", iconKey: "bar" },
  { value: "chartCore/geo-grid", label: "Geo Grid", iconKey: "grid" },
  { value: "chartCore/regression-scatter", label: "Regression Scatter", iconKey: "regression-scatter" },
  { value: "core/grid", label: "Core / Grid", iconKey: "grid" },
  { value: "core/insider-trading", label: "Core / Insider Trading", iconKey: "insider-trading" },
  { value: "recharts/grouped-bar", label: "Grouped Bar", iconKey: "grouped-bar" },
  { value: "recharts/ownership-stacked", label: "Ownership Stacked", iconKey: "stacked-area" },
  { value: "recharts/gauge", label: "Gauge (Recharts)", iconKey: "gauge" },
  { value: "recharts/value-conversion-bridge", label: "Value Conversion Bridge", iconKey: "value-conversion" },
  { value: "recharts/sankey-diagram", label: "Sankey Diagram", iconKey: "sankey" },
  { value: "recharts/dual-axis-stacked-bar", label: "Dual Axis Stacked Bar (Recharts)", iconKey: "dual-axis-stacked-bar" },
  { value: "recharts/radar", label: "Radar", iconKey: "radar" },
  { value: "lightweight/candles", label: "Candlestick", iconKey: "candles" },
];
