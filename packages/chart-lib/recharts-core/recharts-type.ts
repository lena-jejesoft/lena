export type DatetimeType = "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface DatetimeRange {
  datetime_start: string;
  datetime_end: string;
}

export interface UnitSettings {
  datetime_type: DatetimeType;
  datetime_range: DatetimeRange;
  datetime_unit: number;
}

// ============================================================================
// 차트 데이터 타입 (Wide 형식)
// ============================================================================

/**
 * 차트 인풋 데이터 (Wide 형식)
 * - X축: 시간 (date)
 * - 동적 컬럼: 각 계정항목의 값
 */
export interface ChartData {
  date: string;           // ISO 8601 datetime (KST) - 차트 시간축용
  date_display: string;   // 표시용 원본 날짜 (예: "2025-Q3")
  [accountItem: string]: string | number;  // 동적 계정항목 컬럼
}

export type RechartsChartData = ChartData

/** 지원하는 차트 타입 */
export type ChartType = "column" | "line" | "area" | "area-100" | "stacked-area" | "ownership-stacked" | "synced-area" | "mixed" | "stacked" | "stacked-100" | "stacked-grouped" | "dual-axis" | "dual-axis-stacked-bar" | "pie" | "two-level-pie" | "treemap" | "multi-level-treemap" | "ranking-bar" | "geo-grid" | "regression-scatter" | "radar";
export type RechartsChartType = "recharts/column" | "recharts/line" | "recharts/area" | "recharts/area-100" | "recharts/stacked-area" | "recharts/ownership-stacked" | "recharts/synced-area" | "recharts/mixed" | "recharts/stacked" | "recharts/stacked-100" | "recharts/stacked-grouped" | "recharts/dual-axis" | "recharts/pie" | "recharts/two-level-pie" | "recharts/treemap" | "recharts/multi-level-treemap" | "recharts/ranking-bar" | "recharts/geo-grid" | "recharts/regression-scatter" | "recharts/radar";

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


/**
 * 전체 차트 유형 설정
 */
export const CHART_TYPE_CONFIGS: ChartTypeConfig[] = [
  // === 기본 라인/영역 차트 ===
  {
    value: 'line',
    label: '라인',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: true,
    supportsMissingValues: true,
    constraints: { minDataPoints: 5 },
  },
  {
    value: 'area',
    label: '영역',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: true,
    constraints: { minDataPoints: 5 },
  },
  {
    value: 'area-100',
    label: '100% 영역',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: true,
    constraints: { minDataPoints: 5, minSeries: 2, allowNegative: false },
  },
  {
    value: 'stacked-area',
    label: '누적 영역',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { minDataPoints: 5, minSeries: 2, allowNegative: false },
  },
  {
    value: 'synced-area',
    label: '동기화 영역',
    enabled: true,
    seriesMode: 'dual-role',
    seriesRoles: ['좌측', '우측'],
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { minDataPoints: 5, minSeries: 2 },
  },

  // === 막대 차트 ===
  {
    value: 'column',
    label: '막대',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: true,
    supportsMissingValues: true,
  },
  {
    value: 'mixed',
    label: '혼합',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: true,
    supportsMissingValues: true,
    constraints: { minDataPoints: 5, minSeries: 2 },
  },
  {
    value: 'stacked',
    label: '누적막대',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: true,
    constraints: { minSeries: 2 },
  },
  {
    value: 'stacked-100',
    label: '100% 누적막대',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: true,
    constraints: { minSeries: 2, allowNegative: false },
  },
  {
    value: 'ownership-stacked',
    label: '소유 구조 분석',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'none',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { minSeries: 2, allowNegative: false },
  },
  {
    value: 'stacked-grouped',
    label: '그룹형 누적막대',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: true,
    requiresGroupAssignment: true,
    constraints: { minSeries: 3, allowNegative: false },
  },
  {
    value: 'dual-axis',
    label: '이중축',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: true,
    supportsMissingValues: true,
    requiresAxisPlacement: true,
    constraints: { minDataPoints: 5, minSeries: 2 },
  },
  {
    value: 'dual-axis-stacked-bar',
    label: '이중축 그룹형 누적막대',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: true,
    requiresAxisPlacement: true,
    requiresGroupAssignment: true,
    constraints: { minDataPoints: 3, minSeries: 3, allowNegative: false },
  },

  // === 원형/트리맵 차트 (Y축 칼럼들이 조각/영역이 됨) ===
  {
    value: 'pie',
    label: '원형',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: false,
  },
  {
    value: 'two-level-pie',
    label: '2단계 원형',
    enabled: true,
    seriesMode: 'multiple',  // 첫 번째 Y=내부, 나머지=외부
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: false,
  },
  {
    value: 'treemap',
    label: '트리맵',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { minSeries: 2, allowNegative: false },
  },
  {
    value: 'multi-level-treemap',
    label: '멀티레벨 트리맵',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'multiple',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { minSeries: 1, allowNegative: false },
  },

  // === 특수 차트 ===
  {
    value: 'ranking-bar',
    label: '랭킹막대',
    enabled: true,
    seriesMode: 'single',
    yAxisMode: 'single',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { minSeries: 3 },
  },
  {
    value: 'geo-grid',
    label: '지도그리드',
    enabled: true,
    seriesMode: 'single',
    yAxisMode: 'single',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { requiresGeoData: true },
  },
  {
    value: 'regression-scatter',
    label: '회귀 산점도',
    enabled: true,
    seriesMode: 'dual-role',
    seriesRoles: ['X축', 'Y축'],
    yAxisMode: 'none',  // X/Y 역할로 대체
    supportsOutliers: false,  // 자체 이상치 로직 사용
    supportsMissingValues: false,
    constraints: { minDataPoints: 10, minSeries: 2 },
  },
  {
    value: 'radar',
    label: '레이더',
    enabled: true,
    seriesMode: 'multiple',
    yAxisMode: 'none',
    supportsOutliers: false,
    supportsMissingValues: false,
    constraints: { minSeries: 3, allowNegative: false },
  },
];

/**
 * 활성화된 차트 유형만 반환
 */
export const ENABLED_CHART_TYPE_CONFIGS = CHART_TYPE_CONFIGS.filter(c => c.enabled);

/**
 * 차트 유형별 설정 메타데이터
 * _chartCore와 외부 프로젝트(SchemaPanel 등)에서 공통으로 사용
 */

export type SeriesMode =
  | 'none'           // 시리즈 불필요 (geo-grid 등)
  | 'single'         // 단일 시리즈
  | 'multiple'       // 복수 시리즈 (일반적인 라인/막대 등)
  | 'dual-role';     // 역할별 2개 시리즈 (좌/우, X/Y 등)

export type YAxisMode =
  | 'none'           // Y축 불필요 (pie, treemap 등)
  | 'single'         // 단일 Y축
  | 'multiple';      // 복수 Y축 선택 가능
  
/**
 * 차트 타입별 데이터 조건
 */
export interface ChartTypeConstraints {
  minDataPoints?: number;      // 최소 시점 수
  minSeries?: number;          // 최소 시리즈 수
  allowNegative?: boolean;     // 음수 허용 여부 (기본: true)
  requiresHierarchy?: boolean; // 계층구조 필요 (추후 구현)
  requiresGeoData?: boolean;   // 지역정보 필요 (추후 구현)
}

export interface ChartTypeConfig {
  value: string;
  label: string;

  // 활성화 여부
  enabled: boolean;  // UI에서 선택 가능 여부

  // 시리즈 설정
  seriesMode: SeriesMode;
  seriesRoles?: [string, string];  // dual-role일 때 역할명 (예: ['좌측', '우측'])

  // Y축 설정
  yAxisMode: YAxisMode;

  // 기능 활성화 여부
  supportsOutliers: boolean;       // 이상치 표시 지원
  supportsMissingValues: boolean;  // 결측치 표시 지원

  // 추가 설정 필요 여부
  requiresAxisPlacement?: boolean;   // 축 배치 설정 (dual-axis)
  requiresGroupAssignment?: boolean; // 그룹 할당 설정 (stacked-grouped)

  // 데이터 조건
  constraints?: ChartTypeConstraints;
}


/**
 * 차트 유형 값으로 설정 조회
 */
export function getChartTypeConfig(chartType: string): ChartTypeConfig | undefined {
  return CHART_TYPE_CONFIGS.find(c => c.value === chartType);
}
