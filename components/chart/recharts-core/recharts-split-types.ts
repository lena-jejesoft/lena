"use client";

// Minimal shared types for split/outlier rendering (ported conceptually from chartCore-src).

export type RegionType = "upper" | "normal" | "lower";

export interface ChartDataItem {
  date: string;
  date_display: string;
  // series fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface OutlierInfo {
  bound: "upper" | "lower";
  field: string;
  value: number;
  dateDisplay: string;
}

export interface RegionBucket {
  data: ChartDataItem[];
  domain?: [number, number];
  hasData?: boolean;
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
