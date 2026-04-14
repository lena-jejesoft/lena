/**
 * 데이터 트랜스포머
 * LONG 형식 파싱 데이터를 Wide 형식 차트 데이터로 변환
 */

import type { ParsedSDMXData, ChartData, TransformerOptions } from "@chartCore/src/types/sdmx";

/**
 * 분기 패턴 매칭 정규식
 * 예: "2025-Q1", "2024-Q4"
 */
const QUARTER_PATTERN = /^(\d{4})-Q([1-4])$/;

/**
 * 월 패턴 매칭 정규식
 * 예: "2025-01", "2024-12"
 */
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/**
 * 연도 패턴 매칭 정규식
 * 예: "2025", "2024"
 */
const YEAR_PATTERN = /^(\d{4})$/;

/**
 * 분기를 종료일로 변환
 * @param year 연도
 * @param quarter 분기 (1-4)
 * @param timezone 타임존
 */
function quarterToEndDate(year: number, quarter: number, timezone: string = "Asia/Seoul"): string {
  const quarterEndDates = [
    { month: 3, day: 31 },  // Q1: 3월 31일
    { month: 6, day: 30 },  // Q2: 6월 30일
    { month: 9, day: 30 },  // Q3: 9월 30일
    { month: 12, day: 31 }, // Q4: 12월 31일
  ];

  const endDate = quarterEndDates[quarter - 1];
  const date = new Date(year, endDate.month - 1, endDate.day);

  // KST 타임존 offset 추가 (+09:00)
  const offset = timezone === "Asia/Seoul" ? "+09:00" : "+00:00";
  const isoDate = `${year}-${String(endDate.month).padStart(2, "0")}-${String(endDate.day).padStart(2, "0")}T00:00:00${offset}`;

  return isoDate;
}

/**
 * 월을 종료일로 변환
 * @param year 연도
 * @param month 월 (1-12)
 * @param timezone 타임존
 */
function monthToEndDate(year: number, month: number, timezone: string = "Asia/Seoul"): string {
  // 다음 달 0일 = 이번 달 마지막 날
  const lastDay = new Date(year, month, 0).getDate();

  const offset = timezone === "Asia/Seoul" ? "+09:00" : "+00:00";
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T00:00:00${offset}`;

  return isoDate;
}

/**
 * 연도를 종료일로 변환
 * @param year 연도
 * @param timezone 타임존
 */
function yearToEndDate(year: number, timezone: string = "Asia/Seoul"): string {
  const offset = timezone === "Asia/Seoul" ? "+09:00" : "+00:00";
  return `${year}-12-31T00:00:00${offset}`;
}

/**
 * 시점(TIME_PERIOD)을 ISO Date로 변환
 * 분기/월/연도 패턴을 자동 인식하여 종료일 기준으로 변환
 *
 * @param timePeriod 시점 문자열 (예: "2025-Q1", "2025-01", "2025")
 * @param timezone 타임존 (기본: "Asia/Seoul")
 * @returns ISO 8601 datetime (KST)
 */
export function convertToISODate(timePeriod: string, timezone: string = "Asia/Seoul"): string {
  // 분기 패턴
  const quarterMatch = timePeriod.match(QUARTER_PATTERN);
  if (quarterMatch) {
    const year = parseInt(quarterMatch[1], 10);
    const quarter = parseInt(quarterMatch[2], 10);
    return quarterToEndDate(year, quarter, timezone);
  }

  // 월 패턴
  const monthMatch = timePeriod.match(MONTH_PATTERN);
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);
    return monthToEndDate(year, month, timezone);
  }

  // 연도 패턴
  const yearMatch = timePeriod.match(YEAR_PATTERN);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return yearToEndDate(year, timezone);
  }

  // 패턴 매칭 실패 시 원본 반환
  return timePeriod;
}

/**
 * LONG 형식 데이터를 Wide 형식으로 피봇
 *
 * @param parsedData LONG 형식 파싱 데이터
 * @param options 트랜스포머 옵션
 * @returns Wide 형식 차트 데이터
 */
export function transformToChartData(
  parsedData: ParsedSDMXData[],
  options: TransformerOptions = {}
): ChartData[] {
  const timezone = options.timezone || "Asia/Seoul";

  // 시점별로 그룹화
  const groupedByTime = new Map<string, Map<string, number>>();

  for (const data of parsedData) {
    const timePeriod = data.시점;
    const accountItem = data.계정항목;
    const value = data.관측값;

    if (!groupedByTime.has(timePeriod)) {
      groupedByTime.set(timePeriod, new Map());
    }

    const timeGroup = groupedByTime.get(timePeriod)!;
    timeGroup.set(accountItem, value);
  }

  // Wide 형식으로 변환
  const chartData: ChartData[] = [];

  for (const [timePeriod, accountItems] of groupedByTime) {
    const row: ChartData = {
      date: convertToISODate(timePeriod, timezone),
      date_display: timePeriod,
    };

    // 모든 계정항목을 동적 컬럼으로 추가
    for (const [accountItem, value] of accountItems) {
      row[accountItem] = value;
    }

    chartData.push(row);
  }

  // 날짜순 정렬 (오름차순)
  chartData.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  return chartData;
}

/**
 * 차트 데이터에서 모든 계정항목(series) 추출
 *
 * @param chartData Wide 형식 차트 데이터
 * @returns 계정항목 목록
 */
export function extractAccountItems(chartData: ChartData[]): string[] {
  const items = new Set<string>();

  for (const row of chartData) {
    for (const key of Object.keys(row)) {
      if (key !== "date" && key !== "date_display") {
        items.add(key);
      }
    }
  }

  return Array.from(items);
}
