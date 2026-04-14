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
];

/**
 * 활성화된 차트 유형만 반환
 */
export const ENABLED_CHART_TYPE_CONFIGS = CHART_TYPE_CONFIGS.filter(c => c.enabled);

/**
 * 차트 유형 값으로 설정 조회
 */
export function getChartTypeConfig(chartType: string): ChartTypeConfig | undefined {
  return CHART_TYPE_CONFIGS.find(c => c.value === chartType);
}

/**
 * 차트 유형별 드롭다운 옵션 (label만 필요할 때)
 */
export const CHART_TYPE_OPTIONS = CHART_TYPE_CONFIGS.map(c => ({
  value: c.value,
  label: c.label,
}));

/**
 * 이상치 지원 여부 확인
 */
export function supportsOutliers(chartType: string): boolean {
  return getChartTypeConfig(chartType)?.supportsOutliers ?? false;
}

/**
 * 결측치 지원 여부 확인
 */
export function supportsMissingValues(chartType: string): boolean {
  return getChartTypeConfig(chartType)?.supportsMissingValues ?? false;
}

/**
 * dual-role 시리즈 모드인지 확인
 */
export function isDualRoleSeriesMode(chartType: string): boolean {
  return getChartTypeConfig(chartType)?.seriesMode === 'dual-role';
}

/**
 * 시리즈 역할명 조회 (dual-role일 때)
 */
export function getSeriesRoles(chartType: string): [string, string] | undefined {
  return getChartTypeConfig(chartType)?.seriesRoles;
}
