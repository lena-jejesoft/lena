import type { ChartType } from "@/packages/chart-lib/types";
import type { ChartTypeIconKey } from "./chart-type-icon";

export type ChartTypeOption = {
  value: ChartType;
  label: string;
  iconKey: ChartTypeIconKey;
};

export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  // { value: "line", label: "Line (Highcharts)", iconKey: "line" },  // removed: use chartCore/line
  // { value: "highcharts/gauge", label: "Highcharts / Gauge", iconKey: "gauge" },  // removed: use recharts/gauge
  { value: "core/grid", label: "Core / Grid", iconKey: "grid" },
  { value: "core/insider-trading", label: "Core / Insider Trading", iconKey: "insider-trading" },
  { value: "chartCore/line", label: "Line", iconKey: "line" },
  { value: "chartCore/column", label: "Column", iconKey: "column" },
  { value: "chartCore/stacked", label: "Stacked Column", iconKey: "stacked-column" },
  { value: "chartCore/stacked-100", label: "Stacked Column 100%", iconKey: "stacked-column-100" },
  { value: "chartCore/stacked-grouped", label: "Grouped Stacked Column", iconKey: "stacked-column" },
  { value: "chartCore/dual-axis", label: "Dual Axis", iconKey: "dual-axis" },
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
  { value: "chartCore/dual-axis-stacked-bar", label: "Dual Axis Stacked Bar", iconKey: "dual-axis-stacked-bar" },
  { value: "lightweight/candles", label: "Candlestick", iconKey: "candles" },
  // { value: "recharts/line", label: "Recharts/라인" },
  // { value: "recharts/column", label: "Recharts/막대" },
  { value: "recharts/grouped-bar", label: "Grouped Bar", iconKey: "grouped-bar" },
  // { value: "recharts/area", label: "Recharts/영역" },
  // { value: "recharts/area-100", label: "Recharts/100% 영역" },
  // { value: "recharts/stacked-area", label: "Recharts/누적 영역" },
  { value: "recharts/ownership-stacked", label: "Ownership Stacked", iconKey: "stacked-area" },
  { value: "recharts/gauge", label: "Gauge (Recharts)", iconKey: "gauge" },
  { value: "recharts/value-conversion-bridge", label: "Value Conversion Bridge", iconKey: "value-conversion" },
  { value: "recharts/sankey-diagram", label: "Sankey Diagram", iconKey: "sankey" },
  // { value: "recharts/stacked", label: "Recharts/누적 막대" },
  // { value: "recharts/stacked-100", label: "Recharts/100% 누적 막대" },
  // { value: "recharts/stacked-grouped", label: "Recharts/그룹형 누적 막대" },
  // { value: "recharts/pie", label: "Recharts/파이" },
  // { value: "recharts/two-level-pie", label: "Recharts/이중 파이" },
  // { value: "recharts/treemap", label: "Recharts/트리맵" },
  // { value: "recharts/multi-level-treemap", label: "Recharts/멀티 레벨 트리맵" },
  // { value: "recharts/geo-grid", label: "Recharts/지도 그리드" },
  // { value: "recharts/ranking-bar", label: "Recharts/랭킹막대" },
  // { value: "recharts/dual-axis", label: "Recharts/이중축" },
  { value: "recharts/dual-axis-stacked-bar", label: "Dual Axis Stacked Bar (Recharts)", iconKey: "dual-axis-stacked-bar" },
  // { value: "recharts/mixed", label: "Recharts/혼합" },
  // { value: "recharts/synced-area", label: "Recharts/동기화 영역" },
  // { value: "recharts/regression-scatter", label: "Recharts/회귀 산점도" },
  { value: "recharts/radar", label: "Radar", iconKey: "radar" },
  // { value: "area", label: "Area (Highcharts)", iconKey: "area" },  // removed: use chartCore/area
  // { value: "column", label: "Column (Highcharts)", iconKey: "column" },  // removed: use chartCore/column
  // { value: "bar", label: "Bar (Highcharts)", iconKey: "bar" },  // removed: use chartCore/column
  // { value: "pie", label: "Pie (Highcharts)", iconKey: "pie" },  // removed: use chartCore/pie
  // { value: "scatter", label: "Scatter (Highcharts)", iconKey: "scatter" },  // removed: use chartCore/regression-scatter
];
