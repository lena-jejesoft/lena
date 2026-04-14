import { format, getISOWeek, getISOWeekYear } from "date-fns";
import { AIChartConfig, ChartDataItem, DataAnalysisResult, DatetimeType, ExtendedDataAnalysisResult, HierarchyGroup, MissingValueInfo, OutlierInfo, RechartsChartData, RegionClassifiedData, SeriesIQRInfo, UnitSettings } from "./recharts-type";
import { ChartType } from "./recharts-wrapper";
import type { ChartData as OrgChartData } from "@/components/chart/types";

type ChartData = RechartsChartData

/** datetime_type별 한글 레이블 */
const DATETIME_TYPE_LABELS: Record<DatetimeType, string> = {
  minute: "분",
  hour: "시간",
  day: "일",
  week: "주",
  month: "월",
  quarter: "분기",
  year: "연도",
};

/**
 * datetime_type에 따른 그룹 키 생성
 */
export function getGroupKey(date: Date, datetimeType: DatetimeType): string {
  switch (datetimeType) {
    case "minute":
      return format(date, "yyyy-MM-dd HH:mm");
    case "hour":
      return format(date, "yyyy-MM-dd HH:00");
    case "day":
      return format(date, "yyyy-MM-dd");
    case "week":
      return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
    case "month":
      return format(date, "yyyy-MM");
    case "quarter":
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case "year":
      return format(date, "yyyy");
  }
}

/**
 * X축 레이블용 날짜 포맷 변환
 * 연도 단위를 제외한 모든 datetime_type에서 4자리 연도를 2자리로 변경
 */
export function formatDateForXAxis(dateDisplay: string): string {
  if (!dateDisplay) return dateDisplay;

  // 연도 단위 패턴: 정확히 4자리 숫자만
  if (/^\d{4}$/.test(dateDisplay)) {
    return dateDisplay; // 연도는 4자리 유지
  }

  // 4자리 연도를 2자리로 변환 (문자열 시작 부분)
  return dateDisplay.replace(/^(\d{4})/, (match) => match.slice(2));
}

/**
 * ChartData 배열에서 계정항목(시리즈) 필드들을 추출
 */
export function extractSeriesFields(data: ChartData[]): string[] {
  if (!data.length) return [];

  const firstItem = data[0];
  const reservedFields = ["date", "date_display"];

  return Object.keys(firstItem).filter(
    (key) => !reservedFields.includes(key) && typeof firstItem[key] === "number"
  );
}

/**
 * UnitSettings의 datetime_range에 따라 데이터 필터링
 */
export function filterDataByDateRange(
  data: any[],
  unitSettings: UnitSettings
): ChartData[] {
  const { datetime_start, datetime_end } = unitSettings.datetime_range;

  if (!datetime_start && !datetime_end) {
    return data;
  }

  const startTime = datetime_start ? new Date(datetime_start).getTime() : -Infinity;
  const endTime = datetime_end ? new Date(datetime_end).getTime() : Infinity;

  return data.filter((item) => {
    const itemTime = new Date(item.date).getTime();
    return itemTime >= startTime && itemTime <= endTime;
  });
}

/**
 * datetime_type에 따라 데이터를 집계
 * 예: 일별 데이터 → 월별 합계
 */
export function aggregateDataByUnit(
  data: ChartData[],
  unitSettings: UnitSettings
): ChartData[] {
  if (data.length === 0) return data;

  const { datetime_type } = unitSettings;

  // 그룹별 합계
  const groups = new Map<string, ChartData>();
  const numericFields = extractSeriesFields(data);

  for (const item of data) {
    const key = getGroupKey(new Date(item.date), datetime_type);
    if (!groups.has(key)) {
      groups.set(key, { date: key, date_display: key });
    }
    const group = groups.get(key)!;
    for (const field of numericFields) {
      group[field] = ((group[field] as number) || 0) + (item[field] as number);
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * ChartData 배열을 AIChartConfig로 변환
 */
export function chartDataToAIConfig(
  data: ChartData[],
  chartType: ChartType = "line"
): AIChartConfig {
  const yFields = extractSeriesFields(data);

  return {
    chartType,
    data: data.map((item) => ({
      ...item,
    })),
    xField: "date_display",
    yFields,
    showLegend: true,
    showTooltip: true,
  };
}



/**
 * ChartData 배열을 Recharts용 데이터로 변환
 */
export function chartDataToRechartsData(
  data: any[],
  options?: {
    unitSettings?: UnitSettings;
  }
): ChartData[] {
  // UnitSettings가 있으면 데이터 필터링 + 재집계 적용
  let processedData = options?.unitSettings
    ? filterDataByDateRange(data, options.unitSettings)
    : data;

  if (options?.unitSettings) {
    processedData = aggregateDataByUnit(processedData, options.unitSettings);
  }

  return processedData;
}

/**
 * 인풋 JSON 데이터를 ChartData 형식으로 파싱
 */
export function parseInputDataToChartData(inputJson: string | Record<any,any>): ChartData[] {
  try {
    const parsed = typeof inputJson === 'string'?JSON.parse(inputJson):inputJson;

    if (!Array.isArray(parsed)) {
      throw new Error("데이터는 배열 형식이어야 합니다");
    }

    return parsed.map((item) => {
      if (!item.date && !item.date_display) {
        throw new Error("각 데이터 항목에는 date 또는 date_display 필드가 필요합니다");
      }

      return {
        date: item.date || item.date_display,
        date_display: item.date_display || item.date,
        ...item,
      };
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("유효하지 않은 JSON 형식입니다");
    }
    throw error;
  }
}

/**
 * datetime_type의 한글 레이블 반환
 */
export function getDatetimeTypeLabel(type: DatetimeType): string {
  return DATETIME_TYPE_LABELS[type] || "";
}

/**
 * 1.5 IQR 방식으로 이상치/결측치 분석
 */
export function analyzeDataQuality(
  data: ChartData[],
  fields: string[]
): DataAnalysisResult {
  const outliers: OutlierInfo[] = [];
  const missingValues: MissingValueInfo[] = [];
  const iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }> = {};

  // 각 필드별 IQR 계산
  for (const field of fields) {
    const values = data
      .map((d) => d[field])
      .filter((v): v is number => typeof v === "number" && !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length < 4) continue;

    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);
    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;

    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    iqrBounds[field] = { lower, upper, q1, q3 };

    // 이상치 검출
    for (const item of data) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        if (value < lower) {
          outliers.push({
            dateDisplay: item.date_display,
            field,
            value,
            bound: "lower",
          });
        } else if (value > upper) {
          outliers.push({
            dateDisplay: item.date_display,
            field,
            value,
            bound: "upper",
          });
        }
      }
    }
  }

  // 결측치 검출
  for (const item of data) {
    const missingFields = fields.filter((f) => {
      const v = item[f];
      return v === null || v === undefined || (typeof v === "number" && isNaN(v));
    });

    if (missingFields.length > 0) {
      missingValues.push({
        dateDisplay: item.date_display,
        fields: missingFields,
      });
    }
  }

  return { outliers, missingValues, iqrBounds };
}

/**
 * 이상치를 Scatter 데이터로 변환
 */
export function outliersToScatterData(
  outliers: OutlierInfo[]
): Array<{ x: string; y: number; field: string }> {
  return outliers.map((o) => ({
    x: o.dateDisplay,
    y: o.value,
    field: o.field,
  }));
}

/**
 * 데이터를 Upper/Normal/Lower 영역으로 분류
 * - Upper: 하나라도 상한 초과
 * - Lower: 하나라도 하한 미만
 * - Normal: 모든 필드가 범위 내 (이상치 필드는 null로 마스킹)
 */
export function classifyDataByRegion(
  data: ChartData[],
  fields: string[],
  iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }>,
  outliers: OutlierInfo[] = [],
  allFields?: string[]
): RegionClassifiedData {
  const upperData: ChartDataItem[] = [];
  const normalData: ChartDataItem[] = [];
  const lowerData: ChartDataItem[] = [];

  // Step 1: 이상치 인덱싱 (빠른 조회를 위해)
  const outlierMap = new Map<string, Map<string, 'upper' | 'lower'>>();
  for (const outlier of outliers) {
    if (!outlierMap.has(outlier.dateDisplay)) {
      outlierMap.set(outlier.dateDisplay, new Map());
    }
    outlierMap.get(outlier.dateDisplay)!.set(outlier.field, outlier.bound);
  }

  // Step 2: 데이터 분류
  for (const item of data) {
    const dateOutliers = outlierMap.get(item.date_display);

    let hasUpper = false;
    let hasLower = false;

    // Normal용 데이터: 이상치 필드는 null로 마스킹
    const normalItem: ChartDataItem = {
      date: item.date,
      date_display: item.date_display,
    };

    for (const field of fields) {
      const fieldValue = item[field];
      const outlierBound = dateOutliers?.get(field);

      if (outlierBound === 'upper') {
        hasUpper = true;
        normalItem[field] = null;  // 이상치는 null로 설정
      } else if (outlierBound === 'lower') {
        hasLower = true;
        normalItem[field] = null;  // 이상치는 null로 설정
      } else {
        normalItem[field] = fieldValue;  // 정상값 유지
      }
    }

    // 비분석 필드 처리 (좌측 필드 등 - 이중축 차트용)
    if (allFields) {
      const nonAnalyzedFields = allFields.filter(f => !fields.includes(f));
      for (const field of nonAnalyzedFields) {
        normalItem[field] = item[field];  // 항상 값 유지
      }
    }

    // Normal 데이터는 항상 추가 (null 마스킹 적용됨)
    normalData.push(normalItem);

    // Upper/Lower: 이상치 포함 날짜만 추가 (모든 값 포함)
    if (hasUpper) {
      upperData.push({
        ...item,
        date: item.date,
        date_display: item.date_display,
      });
    }
    if (hasLower) {
      lowerData.push({
        ...item,
        date: item.date,
        date_display: item.date_display,
      });
    }
  }

  // Step 3: Domain 계산
  const upperOutlierValues = outliers
    .filter((o) => o.bound === "upper")
    .map((o) => o.value);

  const lowerOutlierValues = outliers
    .filter((o) => o.bound === "lower")
    .map((o) => o.value);

  const calculateOutlierDomain = (
    values: number[],
    normalDomain: [number, number],
    bound: 'upper' | 'lower'
  ): [number, number] => {
    // 이상치가 없으면 Normal 영역 기준으로 마진 추가한 도메인 반환
    if (values.length === 0) {
      const normalRange = normalDomain[1] - normalDomain[0];
      const margin = Math.max(normalRange * 0.1, 10);
      if (bound === 'upper') {
        return [normalDomain[1] + margin * 0.5, normalDomain[1] + margin];
      } else {
        return [normalDomain[0] - margin, normalDomain[0] - margin * 0.5];
      }
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Normal 영역과의 간격 (Normal 범위의 5% 또는 최소 5)
    const normalRange = normalDomain[1] - normalDomain[0];
    const gap = Math.max(normalRange * 0.05, 5);

    // Padding 계산 (범위가 좁을 때 작은 값 사용)
    const effectivePadding = range > 0
      ? range * 0.1
      : Math.min(Math.abs(max) * 0.05, 10);

    if (bound === 'upper') {
      // Upper: 최소값이 Normal 최대값 + gap 이상
      const minBound = normalDomain[1] + gap;
      const naturalMin = min - effectivePadding;

      // Normal 영역 침범 방지: minBound를 절대 밑돌지 않음
      const finalMin = Math.max(naturalMin, minBound);

      // 최소 범위 보장
      const minRange = Math.max(gap * 0.5, 1);
      const adjustedMax = Math.max(
        max + effectivePadding,
        finalMin + minRange
      );

      return [finalMin, adjustedMax];
    } else {
      // Lower: 최대값이 Normal 최소값 - gap 이하
      const maxBound = normalDomain[0] - gap;
      const naturalMax = max + effectivePadding;

      // Normal 영역 침범 방지: maxBound를 절대 넘지 않음
      const finalMax = Math.min(naturalMax, maxBound);

      // 최소 범위 보장
      const minRange = Math.max(gap * 0.5, 1);
      const adjustedMin = Math.min(
        min - effectivePadding,
        finalMax - minRange
      );

      return [adjustedMin, finalMax];
    }
  };

  const calculateNormalDomain = (): [number, number] => {
    let globalLower = Infinity;
    let globalUpper = -Infinity;

    for (const field of fields) {
      const bounds = iqrBounds[field];
      if (bounds) {
        globalLower = Math.min(globalLower, bounds.lower);
        globalUpper = Math.max(globalUpper, bounds.upper);
      }
    }

    if (globalLower === Infinity || globalUpper === -Infinity) {
      return [0, 100];
    }

    // Padding을 작게 설정하여 upper/lower domain과 겹치지 않도록 함
    const padding = (globalUpper - globalLower) * 0.05 || 5;
    return [globalLower - padding, globalUpper + padding];
  };

  // Step 3-1: Normal 도메인 먼저 계산 (기준점)
  const normalDomain = calculateNormalDomain();

  // Step 3-2: Normal을 기준으로 Upper/Lower 도메인 계산
  const upperDomain = calculateOutlierDomain(
    upperOutlierValues,
    normalDomain,
    'upper'
  );

  const lowerDomain = calculateOutlierDomain(
    lowerOutlierValues,
    normalDomain,
    'lower'
  );

  return {
    upper: {
      data: upperData,
      domain: upperDomain,
      hasData: upperData.length > 0,
    },
    normal: {
      data: normalData,
      domain: normalDomain,
    },
    lower: {
      data: lowerData,
      domain: lowerDomain,
      hasData: lowerData.length > 0,
    },
  };
}

/**
 * 영역별 높이 비율 계산 (도메인 범위 기반)
 */
export function calculateRegionHeights(
  classifiedData: RegionClassifiedData,
  totalHeight: number,
  minHeight: number = 50
): { upper: number; normal: number; lower: number } {
  const hasUpper = classifiedData.upper.hasData;
  const hasLower = classifiedData.lower.hasData;

  // 이상치 영역이 없으면 전체를 normal에 할당
  if (!hasUpper && !hasLower) {
    return { upper: 0, normal: totalHeight, lower: 0 };
  }

  // 고정 비율로 높이 계산 (normal 영역이 잘 보이도록)
  const NORMAL_RATIO = 0.70;  // normal 영역 70%
  const OUTLIER_RATIO = 0.30; // 이상치 영역 30%

  let upperHeight = 0;
  let lowerHeight = 0;
  let normalHeight = totalHeight * NORMAL_RATIO;

  if (hasUpper && hasLower) {
    // 둘 다 있으면 15%씩
    upperHeight = Math.max((totalHeight * OUTLIER_RATIO) / 2, minHeight);
    lowerHeight = Math.max((totalHeight * OUTLIER_RATIO) / 2, minHeight);
  } else if (hasUpper) {
    upperHeight = Math.max(totalHeight * OUTLIER_RATIO, minHeight);
  } else if (hasLower) {
    lowerHeight = Math.max(totalHeight * OUTLIER_RATIO, minHeight);
  }

  // 최종 normalHeight 조정 (upper/lower가 최소 높이로 인해 커진 경우)
  normalHeight = totalHeight - upperHeight - lowerHeight;

  return { upper: upperHeight, normal: normalHeight, lower: lowerHeight };
}

/**
 * 이상치를 제외한 정상 데이터만 필터링
 */
export function filterOutliersFromData(
  data: ChartData[],
  fields: string[],
  iqrBounds: Record<string, { lower: number; upper: number; q1: number; q3: number }>
): ChartData[] {
  return data.filter((item) => {
    for (const field of fields) {
      const value = item[field];
      const bounds = iqrBounds[field];

      if (typeof value === "number" && !isNaN(value) && bounds) {
        if (value < bounds.lower || value > bounds.upper) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * 확장된 데이터 품질 분석 (영역 분류 포함)
 */
export function analyzeDataQualityExtended(
  data: ChartData[],
  fields: string[],
  allFields?: string[]
): ExtendedDataAnalysisResult {
  // 기본 분석 수행
  const basicResult = analyzeDataQuality(data, fields);

  // 시리즈별 IQR 정보 생성
  const seriesIQR: SeriesIQRInfo[] = Object.entries(basicResult.iqrBounds).map(
    ([field, bounds]) => ({
      field,
      q1: bounds.q1,
      q3: bounds.q3,
      iqr: bounds.q3 - bounds.q1,
      lowerBound: bounds.lower,
      upperBound: bounds.upper,
    })
  );

  // 데이터 영역 분류 (outliers 전달하여 올바른 domain 계산)
  const classifiedData = classifyDataByRegion(data, fields, basicResult.iqrBounds, basicResult.outliers, allFields);

  return {
    ...basicResult,
    seriesIQR,
    classifiedData,
    hasUpperOutliers: classifiedData.upper.hasData,
    hasLowerOutliers: classifiedData.lower.hasData,
  };
}

/**
 * 파이 차트용 시리즈별 합계 계산
 * 각 시리즈의 전체 기간 합계를 파이 조각으로 변환
 */
export function calculateSeriesSums(
  data: ChartData[],
  fields: string[]
): Array<{ name: string; value: number }> {
  return fields.map(field => {
    let sum = 0;
    for (const item of data) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        sum += value;
      }
    }
    return { name: field, value: sum };
  });
}

/**
 * 시점별 파이 차트 데이터 (Small Multiples)
 * 각 시점마다 시리즈별 값을 파이 조각으로 변환
 */
export interface TimepointPieData {
  timepoint: string;        // date_display 값
  date: string;             // date 값 (정렬용)
  data: Array<{ name: string; value: number }>;
}

export function calculatePieDataByTimepoint(
  data: ChartData[],
  fields: string[]
): TimepointPieData[] {
  return data.map(item => {
    const pieData = fields
      .map(field => {
        const value = item[field];
        return {
          name: field,
          value: typeof value === "number" && !isNaN(value) ? value : 0,
        };
      })
      .filter(d => d.value > 0); // 0 이하 값은 파이에서 제외

    return {
      timepoint: item.date_display || item.date,
      date: item.date,
      data: pieData,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * 2단계 파이 차트용 데이터 변환
 * - innerData: 내부 원 (그룹별 합계 또는 level1별 합계 또는 시리즈별 합계)
 * - outerData: 외부 링 (개별 시리즈 또는 level2 개별 항목 또는 시리즈별 연도별 합계)
 *
 * 우선순위:
 * 1. hierarchyGroups가 있고 그룹이 1개 이상 → 사용자 지정 그룹 모드
 * 2. "::" 구분자 있을 때 → 자동 계층 모드
 * 3. 그 외 → 시리즈별 합계 + 연도별 분해
 */
export function calculateTwoLevelPieData(
  data: ChartData[],
  fields: string[],
  hierarchyGroups?: HierarchyGroup[]
): {
  innerData: Array<{ name: string; value: number }>;
  outerData: Array<{ name: string; value: number; series: string }>;
} {
  // 1. 사용자 지정 그룹 모드 (할당된 시리즈가 하나라도 있을 때만)
  const hasAssignedSeries = hierarchyGroups && hierarchyGroups.length > 0 &&
    hierarchyGroups.some(g => g.series.length > 0);

  if (hasAssignedSeries) {
    const groupSums = new Map<string, number>();
    const outerData: Array<{ name: string; value: number; series: string }> = [];

    // 시리즈별 합계 계산
    const seriesSums = new Map<string, number>();
    for (const item of data) {
      for (const field of fields) {
        const value = item[field];
        if (typeof value === "number" && !isNaN(value)) {
          seriesSums.set(field, (seriesSums.get(field) || 0) + value);
        }
      }
    }

    // 그룹별 합계 및 outerData 생성
    for (const group of hierarchyGroups) {
      let groupSum = 0;

      for (const seriesName of group.series) {
        const seriesSum = seriesSums.get(seriesName) || 0;
        groupSum += seriesSum;

        // outerData에 개별 시리즈 추가 (외부 링은 그룹별)
        if (seriesSum !== 0) {
          outerData.push({
            name: group.name,      // 그룹명
            value: seriesSum,
            series: seriesName,    // 시리즈명 (내부 원과 매칭용)
          });
        }
      }

      if (groupSum !== 0) {
        groupSums.set(group.name, groupSum);
      }
    }

    // innerData 생성 (내부 원은 시리즈별)
    const innerData = outerData.map(item => ({
      name: item.series,     // 시리즈명
      value: item.value,
    }));

    return { innerData, outerData };
  }

  // 2. "::" 구분자가 있으면 자동 계층 모드
  const isHierarchical = fields.some(f => f.includes("::"));

  if (isHierarchical) {
    // 계층 모드: level1::level2 파싱
    const level1Sums = new Map<string, number>();
    const outerData: Array<{ name: string; value: number; series: string }> = [];

    for (const item of data) {
      for (const field of fields) {
        const value = item[field];
        if (typeof value !== "number" || isNaN(value)) continue;

        const parts = field.split("::");
        const level1 = parts[0] || "기타";
        const level2 = parts[1] || field;

        // innerData용: level1별 합계
        level1Sums.set(level1, (level1Sums.get(level1) || 0) + value);

        // outerData용: 개별 항목
        outerData.push({
          name: level2,
          value,
          series: level1,
        });
      }
    }

    // innerData 생성 (level1별 합계)
    const innerData = Array.from(level1Sums.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    return { innerData, outerData };
  }

  // 3. 기존 모드: 시리즈별 합계 + 연도별 분해
  // innerData: 시리즈별 합계
  const innerData = calculateSeriesSums(data, fields);

  // outerData: 시리즈별 연도별 합계
  // 1. 연도별 집계 맵 생성
  const yearSums: Map<string, Map<string, number>> = new Map();

  for (const item of data) {
    // date에서 연도 추출
    const year = new Date(item.date).getFullYear().toString();

    for (const field of fields) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        if (!yearSums.has(field)) {
          yearSums.set(field, new Map());
        }
        const fieldMap = yearSums.get(field)!;
        fieldMap.set(year, (fieldMap.get(year) || 0) + value);
      }
    }
  }

  // 2. 집계된 데이터를 outerData 배열로 변환
  const outerData: Array<{ name: string; value: number; series: string }> = [];
  for (const field of fields) {
    const fieldMap = yearSums.get(field);
    if (fieldMap) {
      // 연도순 정렬
      const sortedYears = Array.from(fieldMap.keys()).sort();
      for (const year of sortedYears) {
        outerData.push({
          name: `${field}_${year}`,
          value: fieldMap.get(year)!,
          series: field,
        });
      }
    }
  }

  return { innerData, outerData };
}

/**
 * 시점별 2단계 파이 차트 데이터 (timepoint selection용)
 * 각 시점마다 innerData와 outerData를 계산
 */
export interface TimepointTwoLevelPieData {
  timepoint: string;        // date_display 값
  date: string;             // date 값 (정렬용)
  innerData: Array<{ name: string; value: number }>;
  outerData: Array<{ name: string; value: number; series: string }>;
}

export function calculateTwoLevelPieDataByTimepoint(
  data: ChartData[],
  fields: string[],
  hierarchyGroups?: HierarchyGroup[]
): TimepointTwoLevelPieData[] {
  return data.map(item => {
    const singleItemData = [item];

    // hierarchyGroups가 있고 할당된 시리즈가 하나라도 있으면 그룹 모드로 계산
    const hasAssignedSeries = hierarchyGroups && hierarchyGroups.length > 0 &&
      hierarchyGroups.some(g => g.series.length > 0);

    if (hasAssignedSeries) {
      const groupSums = new Map<string, number>();
      const outerData: Array<{ name: string; value: number; series: string }> = [];

      // 시리즈별 값 (단일 시점)
      const seriesValues = new Map<string, number>();
      for (const field of fields) {
        const value = item[field];
        if (typeof value === "number" && !isNaN(value)) {
          seriesValues.set(field, value);
        }
      }

      // 그룹별 합계 및 outerData 생성
      for (const group of hierarchyGroups) {
        let groupSum = 0;

        for (const seriesName of group.series) {
          const seriesValue = seriesValues.get(seriesName) || 0;
          groupSum += seriesValue;

          if (seriesValue !== 0) {
            outerData.push({
              name: group.name,      // 그룹명
              value: seriesValue,
              series: seriesName,    // 시리즈명 (내부 원과 매칭용)
            });
          }
        }

        if (groupSum !== 0) {
          groupSums.set(group.name, groupSum);
        }
      }

      // innerData 생성 (내부 원은 시리즈별)
      const innerData = outerData.map(item => ({
        name: item.series,     // 시리즈명
        value: item.value,
      }));

      return {
        timepoint: item.date_display || item.date,
        date: item.date,
        innerData,
        outerData,
      };
    }

    // hierarchyGroups가 없으면 시리즈별 값을 내부/외부 동일하게 표시
    const innerData = fields
      .map(field => {
        const value = item[field];
        return {
          name: field,
          value: typeof value === "number" && !isNaN(value) ? value : 0,
        };
      })
      .filter(d => d.value !== 0);

    // 외부 링도 동일한 데이터로 생성 (라벨 표시용)
    const outerData = innerData.map(d => ({
      name: d.name,
      value: d.value,
      series: d.name,
    }));

    return {
      timepoint: item.date_display || item.date,
      date: item.date,
      innerData,
      outerData,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** 트리맵 자식 노드 타입 */
export interface TreemapChildItem {
  name: string;
  size: number;
  seriesName: string;
}

/** 트리맵 데이터 아이템 타입 */
export interface TreemapDataItem {
  name: string;
  children: TreemapChildItem[];
}

/** 멀티레벨 트리맵 노드 타입 */
export interface MultiLevelTreemapNode {
  name: string;
  size?: number;
  seriesName?: string;
  children?: MultiLevelTreemapNode[];
}

/**
 * 트리맵 차트용 데이터 변환
 * 시리즈를 부모로, 날짜별 값을 자식으로 변환
 * 양수 값만 사용 (Math.abs 적용)
 */
export function calculateTreemapData(
  data: ChartData[],
  fields: string[]
): TreemapDataItem[] {
  return fields.map(field => {
    const children: TreemapChildItem[] = [];

    for (const item of data) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        const absValue = Math.abs(value);
        if (absValue > 0) {
          children.push({
            name: item.date_display || item.date,
            size: absValue,
            seriesName: field,
          });
        }
      }
    }

    return {
      name: field,
      children,
    };
  }).filter(item => item.children.length > 0);
}

/**
 * 멀티레벨 트리맵 차트용 데이터 변환 (계층 그룹 지원)
 * - hierarchyGroups가 있으면: 그룹 → 시리즈 (시리즈별 합계)
 * - hierarchyGroups가 없으면: 시리즈 → 날짜별 값 (기존 방식)
 */
export function calculateMultiLevelTreemapData(
  data: ChartData[],
  fields: string[],
  hierarchyGroups?: HierarchyGroup[]
): MultiLevelTreemapNode[] {
  // 그룹이 있으면 그룹 기반 계층 구조
  if (hierarchyGroups && hierarchyGroups.length > 0) {
    // 시리즈별 합계 계산
    const seriesSums = new Map<string, number>();
    for (const item of data) {
      for (const field of fields) {
        const value = item[field];
        if (typeof value === "number" && !isNaN(value)) {
          seriesSums.set(field, (seriesSums.get(field) || 0) + Math.abs(value));
        }
      }
    }

    // 그룹별 노드 생성
    return hierarchyGroups.map(group => {
      const children: MultiLevelTreemapNode[] = group.series
        .filter(seriesName => (seriesSums.get(seriesName) || 0) > 0)
        .map(seriesName => ({
          name: seriesName,
          size: seriesSums.get(seriesName) || 0,
          seriesName: group.name,
        }));

      return {
        name: group.name,
        seriesName: group.name,
        children,
      };
    }).filter(node => node.children && node.children.length > 0);
  }

  // 그룹이 없으면 기존 방식 (시리즈 → 날짜별 값)
  return fields.map(field => {
    const children: MultiLevelTreemapNode[] = [];

    for (const item of data) {
      const value = item[field];
      if (typeof value === "number" && !isNaN(value)) {
        const absValue = Math.abs(value);
        if (absValue > 0) {
          children.push({
            name: item.date_display || item.date,
            size: absValue,
            seriesName: field,
          });
        }
      }
    }

    return {
      name: field,
      seriesName: field,
      children,
    };
  }).filter(item => item.children && item.children.length > 0);
}

/**
 * 시점별 멀티레벨 트리맵 데이터 (timepoint selection용)
 */
export interface TimepointMultiLevelTreemapData {
  timepoint: string;        // date_display 값
  date: string;             // date 값 (정렬용)
  data: MultiLevelTreemapNode[];  // 해당 시점의 멀티레벨 트리맵 데이터
  hasNegative: boolean;     // 해당 시점에 음수 값이 있는지 여부
}

/**
 * 시점별 멀티레벨 트리맵 데이터 계산
 * 각 시점마다 시리즈별 값을 멀티레벨 트리맵 구조로 변환
 */
export function calculateMultiLevelTreemapDataByTimepoint(
  data: ChartData[],
  fields: string[],
  hierarchyGroups?: HierarchyGroup[]
): TimepointMultiLevelTreemapData[] {
  return data.map(item => {
    let hasNegative = false;

    // 그룹이 있으면 그룹 기반 계층 구조
    if (hierarchyGroups && hierarchyGroups.length > 0) {
      // 시리즈별 값 계산 (단일 시점)
      const seriesValues = new Map<string, number>();
      for (const field of fields) {
        const value = item[field];
        if (typeof value === "number" && !isNaN(value)) {
          if (value < 0) hasNegative = true;
          seriesValues.set(field, Math.abs(value));
        }
      }

      // 그룹별 노드 생성
      const treemapData: MultiLevelTreemapNode[] = hierarchyGroups.map(group => {
        const children: MultiLevelTreemapNode[] = group.series
          .filter(seriesName => (seriesValues.get(seriesName) || 0) > 0)
          .map(seriesName => ({
            name: seriesName,
            size: seriesValues.get(seriesName) || 0,
            seriesName: group.name,
          }));

        return {
          name: group.name,
          seriesName: group.name,
          children,
        };
      }).filter(node => node.children && node.children.length > 0);

      return {
        timepoint: item.date_display || item.date,
        date: item.date,
        data: treemapData,
        hasNegative,
      };
    }

    // 그룹이 없으면 기존 방식 (시리즈별 값)
    const treemapData: MultiLevelTreemapNode[] = fields
      .map(field => {
        const value = item[field];
        if (typeof value === "number" && !isNaN(value)) {
          if (value < 0) hasNegative = true;
          const absValue = Math.abs(value);
          if (absValue > 0) {
            return {
              name: field,
              size: absValue,
              seriesName: field,
            };
          }
        }
        return null;
      })
      .filter((d): d is { name: string; size: number; seriesName: string } => d !== null);

    return {
      timepoint: item.date_display || item.date,
      date: item.date,
      data: treemapData,
      hasNegative,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * 시점별 트리맵 데이터 (timepoint selection용)
 */
export interface TimepointTreemapData {
  timepoint: string;        // date_display 값
  date: string;             // date 값 (정렬용)
  data: TreemapDataItem[];  // 해당 시점의 시리즈별 값
  hasNegative: boolean;     // 해당 시점에 음수 값이 있는지 여부
}

/**
 * 시점별 트리맵 데이터 계산
 * 각 시점마다 시리즈별 값을 트리맵 구조로 변환
 */
export function calculateTreemapDataByTimepoint(
  data: ChartData[],
  fields: string[]
): TimepointTreemapData[] {
  return data.map(item => {
    let hasNegative = false;

    const treemapData: TreemapDataItem[] = fields
      .map(field => {
        const value = item[field];
        if (typeof value === "number" && !isNaN(value)) {
          // 음수 체크
          if (value < 0) {
            hasNegative = true;
          }
          const absValue = Math.abs(value);
          if (absValue > 0) {
            return {
              name: field,
              children: [{
                name: item.date_display || item.date,
                size: absValue,
                seriesName: field,
              }],
            };
          }
        }
        return null;
      })
      .filter((d): d is TreemapDataItem => d !== null);

    return {
      timepoint: item.date_display || item.date,
      date: item.date,
      data: treemapData,
      hasNegative,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * 시점별 랭킹막대 데이터 (timepoint selection용)
 */
export interface TimepointRankingBarData {
  timepoint: string;        // date_display 값
  date: string;             // date 값 (정렬용)
  data: Array<{ name: string; value: number }>;  // 해당 시점의 시리즈별 값
  hasNegative: boolean;     // 해당 시점에 음수 값이 있는지 여부
}

/**
 * 시점별 랭킹막대 데이터 계산
 */
export function calculateRankingBarDataByTimepoint(
  data: ChartData[],
  fields: string[]
): TimepointRankingBarData[] {
  return data.map(item => {
    let hasNegative = false;

    const rankingData = fields
      .map(field => {
        const value = item[field];
        if (typeof value === "number" && !isNaN(value)) {
          if (value < 0) {
            hasNegative = true;
          }
          return {
            name: field,
            value: value,
          };
        }
        return null;
      })
      .filter((d): d is { name: string; value: number } => d !== null)
      .sort((a, b) => b.value - a.value);  // 내림차순 정렬

    return {
      timepoint: item.date_display || item.date,
      date: item.date,
      data: rankingData,
      hasNegative,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * 데이터에 음수 값이 있는지 확인
 */
export function hasNegativeValues(data: ChartData[], fields: string[]): boolean {
  for (const item of data) {
    for (const field of fields) {
      const value = item[field];
      if (typeof value === "number" && value < 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 차트 타입 유효성 검사 결과
 */
export interface ChartTypeValidation {
  type: string;
  label: string;
  valid: boolean;
  reason?: string;
}

/**
 * 데이터 특성에 따라 각 차트 타입의 유효성 검사
 */
export function getValidChartTypes(
  dataPointCount: number,
  seriesCount: number,
  hasNegative: boolean,
  hasGeoData: boolean = false
): ChartTypeValidation[] {
  // chart-type-config에서 직접 import하지 않고 여기서 정의
  // (순환 참조 방지)
  const constraints: Record<string, {
    minDataPoints?: number;
    maxDataPoints?: number;
    minSeries?: number;
    allowNegative?: boolean;
    requiresGeoData?: boolean;
    label: string;
  }> = {
    'line': { minDataPoints: 5, label: '라인' },
    'area': { minDataPoints: 5, label: '영역' },
    'area-100': { minDataPoints: 5, minSeries: 2, allowNegative: false, label: '100% 영역' },
    'stacked-area': { minDataPoints: 5, minSeries: 2, allowNegative: false, label: '누적 영역' },
    'synced-area': { minDataPoints: 5, minSeries: 2, label: '동기화 영역' },
    'column': { label: '막대' },
    'mixed': { minDataPoints: 5, minSeries: 2, label: '혼합' },
    'stacked': { minSeries: 2, label: '누적막대' },
    'stacked-100': { minSeries: 2, allowNegative: false, label: '100% 누적막대' },
    'stacked-grouped': { minSeries: 3, allowNegative: false, label: '그룹형 누적막대' },
    'dual-axis': { minDataPoints: 5, minSeries: 2, label: '이중축' },
    'dual-axis-stacked-bar': { minDataPoints: 3, minSeries: 3, allowNegative: false, label: '이중축 그룹형 누적막대' },
    'pie': { allowNegative: false, label: '원형' },
    'two-level-pie': { allowNegative: false, label: '2단계 원형' },
    'treemap': { minSeries: 2, allowNegative: false, label: '트리맵' },
    'multi-level-treemap': { minSeries: 1, allowNegative: false, label: '멀티레벨 트리맵' },
    'ranking-bar': { minSeries: 3, label: '랭킹막대' },
    'geo-grid': { maxDataPoints: 1, requiresGeoData: true, label: '지도그리드' },
    'regression-scatter': { minDataPoints: 10, minSeries: 2, label: '회귀 산점도' },
  };

  const results: ChartTypeValidation[] = [];

  for (const [type, config] of Object.entries(constraints)) {
    let valid = true;
    let reason: string | undefined;

    // 최소 시점 수 검사
    if (config.minDataPoints && dataPointCount < config.minDataPoints) {
      valid = false;
      reason = `최소 ${config.minDataPoints}개 시점 필요 (현재: ${dataPointCount}개)`;
    }

    // 최대 시점 수 검사
    if (valid && config.maxDataPoints && dataPointCount > config.maxDataPoints) {
      valid = false;
      reason = `최대 ${config.maxDataPoints}개 시점만 가능 (현재: ${dataPointCount}개)`;
    }

    // 최소 시리즈 수 검사
    if (valid && config.minSeries && seriesCount < config.minSeries) {
      valid = false;
      reason = `최소 ${config.minSeries}개 시리즈 필요 (현재: ${seriesCount}개)`;
    }

    // 음수 허용 여부 검사
    if (valid && config.allowNegative === false && hasNegative) {
      valid = false;
      reason = '음수 값 포함 불가';
    }

    // 지역 데이터 필요 여부 검사
    if (valid && config.requiresGeoData && !hasGeoData) {
      valid = false;
      reason = '지역 정보 필요';
    }

    results.push({
      type,
      label: config.label,
      valid,
      reason,
    });
  }

  return results;
}

/**
 * 시점별 지도 그리드 데이터
 */
export interface TimepointGeoGridData {
  timepoint: string;        // date_display 값
  date: string;             // date 값 (정렬용)
  seoulData: Array<{ districtId: string; districtName: string; value: number }>;
  nationalData: Array<{ districtId: string; districtName: string; value: number }>;
}

/**
 * 시점별 회귀 산점도 데이터
 */
export interface TimepointRegressionScatterData {
  timepoint: string;        // date_display 값
  date: string;             // date 값 (정렬용)
  data: Array<{ x: number; y: number; label: string }>;
}
