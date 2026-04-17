// ─── Chart Types ───

export type RechartsChartType =
  | "recharts/line"
  | "recharts/column"
  | "recharts/grouped-bar"
  | "recharts/area"
  | "recharts/area-100"
  | "recharts/stacked-area"
  | "recharts/ownership-stacked"
  | "recharts/gauge"
  | "recharts/value-conversion-bridge"
  | "recharts/sankey-diagram"
  | "recharts/pie"
  | "recharts/two-level-pie"
  | "recharts/treemap"
  | "recharts/multi-level-treemap"
  | "recharts/geo-grid"
  | "recharts/ranking-bar"
  | "recharts/stacked"
  | "recharts/stacked-100"
  | "recharts/dual-axis"
  | "recharts/dual-axis-stacked-bar"
  | "recharts/mixed"
  | "recharts/synced-area"
  | "recharts/regression-scatter"
  | "recharts/stacked-grouped"
  | "recharts/radar";

export type ChartCoreChartType =
  | "chartCore/line"
  | "chartCore/column"
  | "chartCore/stacked"
  | "chartCore/stacked-100"
  | "chartCore/stacked-grouped"
  | "chartCore/dual-axis"
  | "chartCore/dual-axis-stacked-bar"
  | "chartCore/mixed"
  | "chartCore/area"
  | "chartCore/area-100"
  | "chartCore/stacked-area"
  | "chartCore/synced-area"
  | "chartCore/pie"
  | "chartCore/two-level-pie"
  | "chartCore/treemap"
  | "chartCore/multi-level-treemap"
  | "chartCore/ranking-bar"
  | "chartCore/geo-grid"
  | "chartCore/regression-scatter";

export type ChartType =
  | "core/grid"
  | "core/insider-trading"
  | "lightweight/candles"
  | RechartsChartType
  | ChartCoreChartType;

// ─── Point Types ───

/**
 * Unified point type for all non-OHLC charts.
 * pie → x=name (string), y=value
 * scatter → size for bubble radius
 * Others → x=number|string, y=number
 */
export interface CartesianPoint {
  x: number | string;
  y: number;
  label?: string;
  color?: string;
  size?: number;
}

export interface OHLCPoint {
  x: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  turnover?: number | null;
}

export type PointType = CartesianPoint | OHLCPoint;

// ─── Series & Data ───

export interface ChartSeries<P = CartesianPoint> {
  id: string;
  name: string;
  data: P[];
  unit?: string;
  color?: string;
  yAxisId?: string;
  chartType?: ChartType; // per-series override for mixed charts
  visible?: boolean;
  dashStyle?: string;
  opacity?: number;
  lineWidth?: number;
  linkedTo?: string; // link to another series id
}

export type XAxisType = "datetime" | "category" | "numeric";

export interface ChartData {
  series: ChartSeries<PointType>[];
  xAxisType: XAxisType;
}

export interface ChartBlock {
  id: string;
  chartType: ChartType;
  data: ChartData;
  style: ChartStyle;
}

// ─── Style ───

export interface YAxisStyle {
  id: string;
  title?: string;
  position?: "left" | "right";
  unit?: string;
  min?: number;
  max?: number;
  gridLines?: boolean;
  visible?: boolean;
}

export interface ChartStyleBase {
  title?: string;
  colorPalette?: string[];
  legend?: {
    position: "top" | "bottom" | "left" | "right" | "none";
  };
  tooltip?: {
    shared?: boolean;
    split?: boolean;
  };
  background?: string;
  chartCore?: {
    showOutliers?: boolean;
    showMissingValues?: boolean;
  };
}

export interface CartesianStyle extends ChartStyleBase {
  xAxis?: {
    title?: string;
    gridLines?: boolean;
  };
  yAxes?: YAxisStyle[];
  lineWidth?: number;
  markerEnabled?: boolean;
  stacking?: "normal" | "percent";
  dataLabels?: boolean;

  // chartCore-style raw row parsing for regression scatter
  regressionScatter?: {
    xField?: string;
    yField?: string;
  };

  // chartCore-style grouped stacked bars (stacked-grouped)
  stackedGrouped?: {
    // 0 = hidden, 1..N = group number (we start with 2 groups)
    assignments?: Record<string, number>;
    // configured group count shown in legend settings (2..4)
    groupCount?: number;
  };

  // chartCore-style ranking bar (timepoint selection on raw rows)
  rankingBar?: {
    // selected timepoint label (prefer `date_display` in raw rows)
    selectedKey?: string;
  };

  // chartCore-style line from raw rows (quarterly x + per-field toggles + outliers)
  timepointLine?: {
    // per-field visibility (true = show). If omitted, all fields are shown.
    enabled?: Record<string, boolean>;
    // whether to show outlier markers (default true)
    showOutliers?: boolean;
  };

  // chartCore-style dual-axis series placement overrides
  dualAxis?: {
    // per-field axis placement. If omitted, renderer heuristic is used.
    placements?: Record<string, "left" | "right">;
    // optional per-field type override for dual-axis chart
    yFieldTypes?: Record<string, "column" | "line">;
  };

  // chartCore-style synced-area field selection
  syncedArea?: {
    // left panel series field id
    leftField?: string;
    // right panel series field id
    rightField?: string;
  };

  // lightweight 캔들 차트 옵션
  lightweightCandles?: {
    // 시나리오 밴드 유형 (기본 BASE)
    scenario?: Scenario;
    // BandsIndicator 표시 여부 (기본 true)
    showBandsIndicator?: boolean;
    // 거래량 히스토그램 표시 여부
    showVolume?: boolean;
    // 5일 이평선 표시 여부
    showMa5?: boolean;
    // 이평선 기간 (기본 5)
    maPeriod?: number;
    // 시리즈별 캔들 상승/하락 색상
    candleSeriesColors?: Record<string, {
      up: string;
      down: string;
    }>;
  };
}

export interface PieStyle extends ChartStyleBase {
  innerRadius?: number;
  dataLabels?: boolean;
  showPercentage?: boolean;

  // chartCore-style pie driven from raw row data (timepoint selection + field toggles)
  timepointPie?: {
    // selected timepoint label (prefer `date_display` in raw rows)
    selectedKey?: string;
    // per-field visibility (true = show). If omitted, all fields are shown.
    enabled?: Record<string, boolean>;
  };

  // chartCore-style two-level pie (two rings: group + items)
  twoLevelPie?: {
    // 0 = hidden, 1..N = group number (we start with 2 groups)
    assignments?: Record<string, number>;
    // selected timepoint label (prefer `date_display` in raw rows)
    selectedKey?: string;
    // optional hierarchy groups for group settings panel
    hierarchyGroups?: Array<{ name: string; series: string[] }>;
  };
}

export interface TreemapStyle extends ChartStyleBase {
  treemap?: {
    // selected timepoint label (prefer `date_display` in raw rows)
    selectedKey?: string;
    // per-field visibility (true = show). If omitted, all fields are shown.
    enabled?: Record<string, boolean>;
    // optional hierarchy groups for multi-level-treemap / legend panel
    hierarchyGroups?: Array<{ name: string; series: string[] }>;
  };
}

export interface GeoGridStyle extends ChartStyleBase {
  geoGrid?: {
    mapLevel?: "seoul" | "national";
    selectedTimepoint?: string;
    metricId?: string;
  };
}

export type ChartStyle = CartesianStyle | PieStyle | TreemapStyle | GeoGridStyle;

// ─── Chart Time Range (compatible with existing) ───

export interface ChartTimeRange {
  min: number;
  max: number;
}

export type Scenario = "BASE" | "BULL" | "BEAR";

export interface ChartCoreLegendSeries {
  id: string;
  label: string;
  color?: string;
}

export interface ChartCoreLegendGroup {
  id: string;
  label: string;
  color?: string;
  series: ChartCoreLegendSeries[];
}

export interface ChartCoreLegendMeta {
  chartType: "two-level-pie" | "multi-level-treemap";
  groups: ChartCoreLegendGroup[];
}

// ─── DataChart Props ───

export interface DataChartProps {
  data: ChartData;
  chartType: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  style?: ChartStyle;
  scenario?: Scenario;
  onStyleChange?: (style: ChartStyle) => void;
  onLegendStateChange?: (state: { tooltipPayload: any[] | null; hoveredLabel: string | null }) => void;

  sidebar?: React.ReactNode;
  toolbar?: React.ReactNode;
  availableChartTypes?: ChartType[];
  hideChartCoreLegendPanel?: boolean;
  chartCoreLegendContainer?: HTMLElement | null;
  chartCoreSeriesColorOverrides?: Record<string, string>;
  chartCoreGroupColorOverrides?: Record<string, string>;
  onChartCoreLegendMetaChange?: (meta: ChartCoreLegendMeta | null) => void;

  height?: number;
  onTimeRangeChange?: (range: ChartTimeRange) => void;
  isEmpty?: boolean;
  emptyMessage?: string;
}
