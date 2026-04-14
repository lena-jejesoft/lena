/** 지원하는 차트 타입 */
export type ChartType = "column" | "line" | "area" | "area-100" | "stacked-area" | "synced-area" | "mixed" | "stacked" | "stacked-100" | "stacked-grouped" | "dual-axis" | "dual-axis-stacked-bar" | "pie" | "two-level-pie" | "treemap" | "multi-level-treemap" | "ranking-bar" | "geo-grid" | "regression-scatter";

/** Y축 배치 타입 */
export type YAxisPlacement = "left" | "right";

/** 차트 테마 색상 */
export interface ChartThemeColors {
  textColor: string;
  axisLineColor: string;
  gridColor: string;
  seriesColors: string[];
}

/** 차트 데이터 구조 */
export interface ChartDataItem {
  date: string;
  date_display: string;
  [key: string]: string | number | null;
}

/** AI 에이전트가 생성할 간소화된 차트 설정 */
export interface AIChartConfig {
  chartType: ChartType;
  title?: string;
  description?: string;
  data: Array<Record<string, number | string>>;
  xField: string;
  yFields: string[];
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
}

/** 기본 AIChartConfig 생성 */
export function createDefaultChartConfig(
  data: Array<Record<string, number | string>>,
  xField: string,
  yFields: string[]
): AIChartConfig {
  return {
    chartType: "line",
    data,
    xField,
    yFields,
    showLegend: true,
    showTooltip: true,
  };
}

/** 이상치 정보 */
export interface OutlierInfo {
  dateDisplay: string;
  field: string;
  value: number;
  bound: "upper" | "lower";
}

/** 결측치 정보 */
export interface MissingValueInfo {
  dateDisplay: string;
  fields: string[];
}

/** 데이터 분석 결과 */
export interface DataAnalysisResult {
  outliers: OutlierInfo[];
  missingValues: MissingValueInfo[];
  iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }>;
}

/** 데이터 품질 옵션 */
export interface DataQualityOptions {
  showOutliers: boolean;
  showMissingValues: boolean;
}

/** 시리즈별 IQR 정보 */
export interface SeriesIQRInfo {
  field: string;
  q1: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
}

/** 영역별 데이터 분류 결과 */
export interface RegionClassifiedData {
  upper: {
    data: ChartDataItem[];
    domain: [number, number];
    hasData: boolean;
  };
  normal: {
    data: ChartDataItem[];
    domain: [number, number];
  };
  lower: {
    data: ChartDataItem[];
    domain: [number, number];
    hasData: boolean;
  };
}

/** 확장된 데이터 분석 결과 (영역 분류 포함) */
export interface ExtendedDataAnalysisResult extends DataAnalysisResult {
  seriesIQR: SeriesIQRInfo[];
  classifiedData: RegionClassifiedData | null;
  leftClassifiedData?: RegionClassifiedData;  // 이중축 좌측
  rightClassifiedData?: RegionClassifiedData;  // 이중축 우측
  hasUpperOutliers: boolean;
  hasLowerOutliers: boolean;
}

/** 레전드 아이템 값 상태 */
export type LegendValueState = 'normal' | 'outlier' | 'missing';

/** 계층 그룹 (two-level-pie용) */
export interface HierarchyGroup {
  name: string;           // 사용자가 입력한 그룹명
  series: string[];       // 할당된 시리즈들
}
