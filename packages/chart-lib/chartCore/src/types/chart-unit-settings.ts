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
