import type { ChartType } from "./types";

// ─── Point type families ───

export type PointFamily = "cartesian" | "ohlc";

export interface ChartTypeSpecBase {
  pointType: PointFamily;
  xAxisTypes: ("datetime" | "category" | "numeric")[];
  label: string;
  renderer: "recharts" | "lightweight" | "core" | "chartcore";
}

export interface RechartsChartTypeSpec extends ChartTypeSpecBase {
  renderer: "recharts";
}

export interface LightweightChartTypeSpec extends ChartTypeSpecBase {
  renderer: "lightweight";
}

export interface CoreChartTypeSpec extends ChartTypeSpecBase {
  renderer: "core";
}

export interface ChartCoreChartTypeSpec extends ChartTypeSpecBase {
  renderer: "chartcore";
}

export type ChartTypeSpec =
  | RechartsChartTypeSpec
  | LightweightChartTypeSpec
  | CoreChartTypeSpec
  | ChartCoreChartTypeSpec;

export const CHART_TYPE_REGISTRY: Record<ChartType, ChartTypeSpec> = {
  "core/grid": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Core/표",
    renderer: "core",
  },
  "core/insider-trading": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Core/내부자 거래",
    renderer: "core",
  },
  "chartCore/line": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/라인",
    renderer: "chartcore",
  },
  "chartCore/column": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/막대",
    renderer: "chartcore",
  },
  "chartCore/stacked": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/누적 막대",
    renderer: "chartcore",
  },
  "chartCore/stacked-100": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/100% 누적 막대",
    renderer: "chartcore",
  },
  "chartCore/stacked-grouped": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/그룹형 누적 막대",
    renderer: "chartcore",
  },
  "chartCore/dual-axis": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/이중축",
    renderer: "chartcore",
  },
  "chartCore/dual-axis-stacked-bar": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/이중축 그룹형 누적 막대",
    renderer: "chartcore",
  },
  "chartCore/mixed": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/혼합",
    renderer: "chartcore",
  },
  "chartCore/area": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/영역",
    renderer: "chartcore",
  },
  "chartCore/area-100": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/100% 영역",
    renderer: "chartcore",
  },
  "chartCore/stacked-area": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/누적 영역",
    renderer: "chartcore",
  },
  "chartCore/synced-area": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "ChartCore/동기화 영역",
    renderer: "chartcore",
  },
  "chartCore/pie": {
    pointType: "cartesian",
    xAxisTypes: ["category"],
    label: "ChartCore/원형",
    renderer: "chartcore",
  },
  "chartCore/two-level-pie": {
    pointType: "cartesian",
    xAxisTypes: ["category"],
    label: "ChartCore/이중 파이",
    renderer: "chartcore",
  },
  "chartCore/treemap": {
    pointType: "cartesian",
    xAxisTypes: ["category"],
    label: "ChartCore/트리맵",
    renderer: "chartcore",
  },
  "chartCore/multi-level-treemap": {
    pointType: "cartesian",
    xAxisTypes: ["category"],
    label: "ChartCore/멀티레벨 트리맵",
    renderer: "chartcore",
  },
  "chartCore/ranking-bar": {
    pointType: "cartesian",
    xAxisTypes: ["category"],
    label: "ChartCore/랭킹 막대",
    renderer: "chartcore",
  },
  "chartCore/geo-grid": {
    pointType: "cartesian",
    xAxisTypes: ["category"],
    label: "ChartCore/지오그리드",
    renderer: "chartcore",
  },
  "chartCore/regression-scatter": {
    pointType: "cartesian",
    xAxisTypes: ["numeric", "category", "datetime"],
    label: "ChartCore/회귀 산점도",
    renderer: "chartcore",
  },
  "lightweight/candles": {
    pointType: "ohlc",
    xAxisTypes: ["datetime"],
    label: "Lightweight/캔들",
    renderer: "lightweight",
  },

  "recharts/line": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/라인",
    renderer: "recharts",
  },
  "recharts/column": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/막대",
    renderer: "recharts",
  },
  "recharts/grouped-bar": {
    pointType: "cartesian",
    xAxisTypes: ["category"],
    label: "Recharts/묶음 막대 비교",
    renderer: "recharts",
  },
  "recharts/area": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/영역",
    renderer: "recharts",
  },
  "recharts/area-100": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/100% 영역",
    renderer: "recharts",
  },
  "recharts/stacked-area": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/누적 영역",
    renderer: "recharts",
  },
  "recharts/ownership-stacked": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/소유 구조 분석",
    renderer: "recharts",
  },
  "recharts/gauge": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/게이지",
    renderer: "recharts",
  },
  "recharts/value-conversion-bridge": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/가치 전환 구조도",
    renderer: "recharts",
  },
  "recharts/sankey-diagram": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/샌키 차트",
    renderer: "recharts",
  },
  "recharts/stacked": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/누적 막대",
    renderer: "recharts",
  },
  "recharts/stacked-100": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/100% 누적 막대",
    renderer: "recharts",
  },
  "recharts/pie": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/파이",
    renderer: "recharts",
  },
  "recharts/two-level-pie": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/이중 파이",
    renderer: "recharts",
  },
  "recharts/treemap": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/트리맵",
    renderer: "recharts",
  },
  "recharts/multi-level-treemap": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/멀티 레벨 트리맵",
    renderer: "recharts",
  },
  "recharts/geo-grid": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/지도 그리드",
    renderer: "recharts",
  },
  "recharts/ranking-bar": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/랭킹막대",
    renderer: "recharts",
  },
  "recharts/dual-axis": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/이중축",
    renderer: "recharts",
  },
  "recharts/dual-axis-stacked-bar": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category"],
    label: "Recharts/이중축 그룹형 누적 막대",
    renderer: "recharts",
  },
  "recharts/mixed": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/혼합",
    renderer: "recharts",
  },
  "recharts/synced-area": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category", "numeric"],
    label: "Recharts/동기화 영역",
    renderer: "recharts",
  },
  "recharts/regression-scatter": {
    pointType: "cartesian",
    xAxisTypes: ["numeric"],
    label: "Recharts/회귀 산점도",
    renderer: "recharts",
  },
  "recharts/stacked-grouped": {
    pointType: "cartesian",
    xAxisTypes: ["datetime", "category"],
    label: "Recharts/그룹형 누적 막대",
    renderer: "recharts",
  },
  "recharts/radar": {
    pointType: "cartesian",
    xAxisTypes: [],
    label: "Recharts/레이더",
    renderer: "recharts",
  },
};

// ─── Compatible chart types ───

/**
 * Returns chart types that are compatible with the given data.
 * Compatibility is determined by:
 * 1. Same pointType (e.g. cartesian data can't render as pie)
 * 2. xAxisType supported by the target chart type
 *
 * If `allowed` is provided, results are further filtered to that list.
 */
export function getCompatibleChartTypes(
  currentType: ChartType,
  xAxisType: "datetime" | "category" | "numeric",
  allowed?: ChartType[]
): ChartType[] {
  const currentSpec = CHART_TYPE_REGISTRY[currentType];
  if (!currentSpec) return [];
  const pool = allowed ?? (Object.keys(CHART_TYPE_REGISTRY) as ChartType[]);

  return pool.filter((t) => {
    const spec = CHART_TYPE_REGISTRY[t];
    if (!spec) return false;
    // Must share the same point type family
    if (spec.pointType !== currentSpec.pointType) return false;
    // Target must support the current xAxisType (empty xAxisTypes — always ok)
    if (spec.xAxisTypes.length > 0 && !spec.xAxisTypes.includes(xAxisType)) return false;
    return true;
  });
}

// ─── Style options per chart type ───

export type StyleOptionKey =
  | "colorPalette"
  | "lineWidth"
  | "markerEnabled"
  | "stacking"
  | "dataLabels"
  | "yAxes"
  | "legend"
  | "tooltip"
  | "innerRadius"
  | "showPercentage";

export interface StyleOptionSpec {
  styleType: "cartesian" | "pie";
  options: StyleOptionKey[];
}

export const CHART_STYLE_OPTIONS: Record<ChartType, StyleOptionSpec> = {
  "core/grid": {
    styleType: "cartesian",
    options: [],
  },
  "core/insider-trading": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/line": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/column": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/stacked": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/stacked-100": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/stacked-grouped": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/dual-axis": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/dual-axis-stacked-bar": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/mixed": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/area": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/area-100": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/stacked-area": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/synced-area": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/pie": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/two-level-pie": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/treemap": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/multi-level-treemap": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/ranking-bar": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/geo-grid": {
    styleType: "cartesian",
    options: [],
  },
  "chartCore/regression-scatter": {
    styleType: "cartesian",
    options: [],
  },
  "recharts/line": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "markerEnabled", "yAxes", "legend", "tooltip"],
  },
  "recharts/column": {
    styleType: "cartesian",
    options: ["colorPalette", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/grouped-bar": {
    styleType: "cartesian",
    options: ["colorPalette", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/area": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "yAxes", "legend", "tooltip"],
  },
  "recharts/area-100": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "yAxes", "legend", "tooltip"],
  },
  "recharts/stacked-area": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "yAxes", "legend", "tooltip"],
  },
  "recharts/ownership-stacked": {
    styleType: "cartesian",
    options: ["colorPalette", "legend", "tooltip"],
  },
  "recharts/gauge": {
    styleType: "cartesian",
    options: ["colorPalette", "legend", "tooltip"],
  },
  "recharts/value-conversion-bridge": {
    styleType: "cartesian",
    options: ["colorPalette", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/sankey-diagram": {
    styleType: "cartesian",
    options: ["colorPalette", "legend", "tooltip"],
  },
  "recharts/stacked": {
    styleType: "cartesian",
    options: ["colorPalette", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/stacked-100": {
    styleType: "cartesian",
    options: ["colorPalette", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/pie": {
    styleType: "pie",
    options: ["colorPalette", "innerRadius", "dataLabels", "showPercentage", "legend"],
  },
  "recharts/two-level-pie": {
    styleType: "pie",
    options: ["colorPalette", "innerRadius", "dataLabels", "showPercentage", "legend"],
  },
  "recharts/treemap": {
    styleType: "cartesian",
    options: ["colorPalette", "legend", "tooltip"],
  },
  "recharts/multi-level-treemap": {
    styleType: "cartesian",
    options: ["colorPalette", "legend", "tooltip"],
  },
  "recharts/geo-grid": {
    styleType: "cartesian",
    options: ["colorPalette", "legend", "tooltip"],
  },
  "recharts/ranking-bar": {
    styleType: "cartesian",
    options: ["colorPalette", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/dual-axis": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "markerEnabled", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/dual-axis-stacked-bar": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "markerEnabled", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/mixed": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "markerEnabled", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/synced-area": {
    styleType: "cartesian",
    options: ["colorPalette", "lineWidth", "yAxes", "legend", "tooltip"],
  },
  "recharts/regression-scatter": {
    styleType: "cartesian",
    options: ["colorPalette", "markerEnabled", "yAxes", "legend", "tooltip"],
  },
  "recharts/stacked-grouped": {
    styleType: "cartesian",
    options: ["colorPalette", "dataLabels", "yAxes", "legend", "tooltip"],
  },
  "recharts/radar": {
    styleType: "cartesian",
    options: ["colorPalette", "legend", "tooltip"],
  },
  "lightweight/candles": {
    styleType: "cartesian",
    options: ["yAxes", "tooltip"],
  },
};

// ─── Style option labels (for sidebar/modal UI) ───

export const STYLE_OPTION_LABELS: Record<StyleOptionKey, string> = {
  colorPalette: "색상 팔레트",
  lineWidth: "선 두께",
  markerEnabled: "마커 표시",
  stacking: "스태킹",
  dataLabels: "데이터 라벨",
  yAxes: "Y축 설정",
  legend: "범례",
  tooltip: "툴팁",
  innerRadius: "내부 반지름",
  showPercentage: "퍼센트 표시",
};
