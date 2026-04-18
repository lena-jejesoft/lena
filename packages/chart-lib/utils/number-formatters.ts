/**
 * 숫자 포맷 공용 유틸.
 *
 * 정책 요약:
 * - 기본 로케일: 한국어 조/억/만.
 * - 축/범례/콜아웃은 축약 (formatCompact), 툴팁/상세는 원본 콤마 (formatFull).
 * - 큰 값일수록 축약 — 억 구간은 콤마 정수 + "억" (decimals=0 강제),
 *   조 구간은 decimals 옵션 (기본 1자리).
 * - 축약 값에 원본 정밀도를 잃지 않도록, 소비처에서 title/tooltip 으로 formatFull 동반 노출 권장.
 */

export type FormatLocale = "ko" | "en";

export interface CompactFormatOptions {
  locale?: FormatLocale;
  decimals?: number;
  signed?: boolean;
  unit?: string;
  minThreshold?: number;
  fallback?: string;
}

export interface FullFormatOptions {
  locale?: FormatLocale;
  decimals?: number;
  signed?: boolean;
  unit?: string;
  fallback?: string;
}

export interface PercentFormatOptions {
  decimals?: number;
  scale?: "ratio" | "percent";
  signed?: boolean;
  fallback?: string;
}

const DEFAULT_FALLBACK = "—";
const KO_LOCALE = "ko-KR";
const EN_LOCALE = "en-US";

function getLocaleTag(locale: FormatLocale): string {
  return locale === "ko" ? KO_LOCALE : EN_LOCALE;
}

function applySign(value: number, signed: boolean): string {
  if (value === 0) return "";
  if (value < 0) return "-";
  return signed ? "+" : "";
}

function formatDecimalWithLocale(value: number, decimals: number, locale: FormatLocale): string {
  return value.toLocaleString(getLocaleTag(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 큰 값을 축약 — 축/범례/콜아웃용.
 *
 * 예 (ko):
 *   formatCompact(3_370_863_000_000) → "3.4조"
 *   formatCompact(145_900_000_000)   → "1,459억"
 *   formatCompact(15_000_000)        → "1,500만"
 *   formatCompact(8_500)             → "8,500"
 *   formatCompact(-1_459_000_000)    → "-15억"
 *   formatCompact(1_459_000_000, { signed: true }) → "+15억"
 */
export function formatCompact(value: number, opts: CompactFormatOptions = {}): string {
  const {
    locale = "ko",
    decimals = 1,
    signed = false,
    unit = "",
    minThreshold = 10_000,
    fallback = DEFAULT_FALLBACK,
  } = opts;

  if (!Number.isFinite(value)) return fallback;
  if (value === 0) return `0${unit}`;

  const sign = applySign(value, signed);
  const abs = Math.abs(value);

  if (locale === "ko") {
    if (abs >= 1e12) {
      return `${sign}${formatDecimalWithLocale(abs / 1e12, decimals, "ko")}조${unit}`;
    }
    if (abs >= 1e8) {
      return `${sign}${Math.round(abs / 1e8).toLocaleString(KO_LOCALE)}억${unit}`;
    }
    if (abs >= minThreshold && abs >= 1e4) {
      return `${sign}${Math.round(abs / 1e4).toLocaleString(KO_LOCALE)}만${unit}`;
    }
    return `${sign}${Math.round(abs).toLocaleString(KO_LOCALE)}${unit}`;
  }

  // English B/M/K
  if (abs >= 1e9) {
    return `${sign}${formatDecimalWithLocale(abs / 1e9, decimals, "en")}B${unit}`;
  }
  if (abs >= 1e6) {
    return `${sign}${formatDecimalWithLocale(abs / 1e6, decimals, "en")}M${unit}`;
  }
  if (abs >= 1e3 && abs >= minThreshold) {
    return `${sign}${formatDecimalWithLocale(abs / 1e3, decimals, "en")}K${unit}`;
  }
  return `${sign}${Math.round(abs).toLocaleString(EN_LOCALE)}${unit}`;
}

/**
 * 원본 값 콤마 구분 — 툴팁/상세/법정 문서용.
 *
 * 예:
 *   formatFull(3_370_863_000_000) → "3,370,863,000,000"
 *   formatFull(1.2345, { decimals: 2 }) → "1.23"
 */
export function formatFull(value: number, opts: FullFormatOptions = {}): string {
  const {
    locale = "ko",
    decimals = 0,
    signed = false,
    unit = "",
    fallback = DEFAULT_FALLBACK,
  } = opts;

  if (!Number.isFinite(value)) return fallback;

  const sign = applySign(value, signed);
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(getLocaleTag(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${formatted}${unit}`;
}

/**
 * 비율 포맷. 기본 입력은 0~1 ratio, scale="percent" 로 이미 0~100 값 받음.
 *
 * 예:
 *   formatPercent(0.419) → "41.9%"
 *   formatPercent(41.9, { scale: "percent" }) → "41.9%"
 *   formatPercent(0.123, { signed: true })    → "+12.3%"
 */
export function formatPercent(value: number, opts: PercentFormatOptions = {}): string {
  const {
    decimals = 1,
    scale = "ratio",
    signed = false,
    fallback = DEFAULT_FALLBACK,
  } = opts;

  if (!Number.isFinite(value)) return fallback;

  const pct = scale === "ratio" ? value * 100 : value;
  const sign = applySign(pct, signed);
  const abs = Math.abs(pct);
  return `${sign}${abs.toFixed(decimals)}%`;
}

// -------- 편의 프리셋 --------

/** Recharts Y/X축 tickFormatter 직결. decimals 1, ko 기본. */
export const axisTickFormatter = (value: number): string =>
  formatCompact(value, { decimals: 1 });

/** 툴팁 값 — 원본 보존. 정수면 그대로, 소수점 값은 최대 2자리까지. */
export function formatTooltipValue(value: number, opts: { maxDecimals?: number; unit?: string } = {}): string {
  const { maxDecimals = 2, unit = "" } = opts;
  if (!Number.isFinite(value)) return DEFAULT_FALLBACK;
  const isInteger = Number.isInteger(value);
  return `${value.toLocaleString(KO_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: isInteger ? 0 : maxDecimals,
  })}${unit}`;
}

/** 범례 값. 축약 1자리. */
export const formatLegendValue = (value: number): string =>
  formatCompact(value, { decimals: 1 });

/** 파이 조각 콜아웃 값. 축약 2자리 — 상세 정밀도 유지. */
export const formatPieCalloutValue = (value: number): string =>
  formatCompact(value, { decimals: 2 });

/** 통계 지표 (R², slope 등). 고정 소수. */
export function formatStat(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return DEFAULT_FALLBACK;
  return value.toFixed(decimals);
}
