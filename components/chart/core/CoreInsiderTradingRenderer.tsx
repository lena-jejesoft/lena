"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { ChartData, ChartStyle } from "../types";

type RawRow = Record<string, unknown>;

type InsiderRow = {
  date: Date;
  action: "buy" | "sell";
  shares: number;
  valueUsd: number;
  entityType: "individual" | "company";
};

type BucketAggregate = {
  key: string;
  label: string;
  soldShares: number;
  boughtShares: number;
  soldValue: number;
  boughtValue: number;
  soldIndividuals: number;
  soldCompanies: number;
  boughtIndividuals: number;
  boughtCompanies: number;
};

const BUCKETS: Array<{ key: string; label: string; minMonths: number; maxMonths: number }> = [
  { key: "0-3", label: "0-3", minMonths: 0, maxMonths: 3 },
  { key: "3-6", label: "3-6", minMonths: 3, maxMonths: 6 },
  { key: "6-9", label: "6-9", minMonths: 6, maxMonths: 9 },
  { key: "9-12", label: "9-12", minMonths: 9, maxMonths: 12 },
];

function isPlainObject(value: unknown): value is RawRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCartesianOrOhlcPoint(row: RawRow): boolean {
  return (
    ("x" in row && "y" in row && typeof row.y === "number") ||
    ("open" in row && "high" in row && "low" in row && "close" in row)
  );
}

function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseAction(value: unknown): "buy" | "sell" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "buy" || normalized === "매수") return "buy";
  if (normalized === "sell" || normalized === "매도") return "sell";
  return null;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseEntityType(value: unknown): "individual" | "company" {
  if (typeof value !== "string") return "individual";
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("company") || normalized.includes("corp") || normalized.includes("법인")) {
    return "company";
  }
  return "individual";
}

function toInsiderRows(data: ChartData): InsiderRow[] {
  const normalized: InsiderRow[] = [];

  for (const series of data.series) {
    for (const point of series.data as unknown[]) {
      if (!isPlainObject(point)) continue;
      if (isCartesianOrOhlcPoint(point)) continue;

      const date = parseDate(point.date ?? point.date_display);
      const action = parseAction(point.action ?? point.side);
      const shares = parseNumber(point.shares);
      const valueUsd = parseNumber(point.value ?? point.amount);

      if (!date || !action || shares <= 0) continue;

      normalized.push({
        date,
        action,
        shares,
        valueUsd,
        entityType: parseEntityType(point.entity),
      });
    }
  }

  return normalized;
}

function toAgeMonths(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

function formatShares(value: number): string {
  if (value <= 0) return "0";
  return `${Math.round(value).toLocaleString("ko-KR")}주`;
}

function formatApproxUsd(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    const num = abs / 1_000_000_000;
    return `약 US$${num.toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    const num = abs / 1_000_000;
    return `약 US$${num.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    const num = abs / 1_000;
    return `약 US$${num.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `약 US$${Math.round(abs).toLocaleString("en-US")}`;
}

function barWidthPercent(value: number, maxValue: number): string {
  if (value <= 0 || maxValue <= 0) return "0%";
  const percent = (value / maxValue) * 100;
  const normalized = Math.max(0.7, Math.min(100, percent));
  return `${normalized}%`;
}

export function CoreInsiderTradingRenderer({
  data,
  style,
  height,
}: {
  data: ChartData;
  style?: ChartStyle;
  height?: number;
}) {
  const now = useMemo(() => new Date(), []);

  const aggregates = useMemo(() => {
    const rows = toInsiderRows(data);
    const initial: BucketAggregate[] = BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      soldShares: 0,
      boughtShares: 0,
      soldValue: 0,
      boughtValue: 0,
      soldIndividuals: 0,
      soldCompanies: 0,
      boughtIndividuals: 0,
      boughtCompanies: 0,
    }));

    rows.forEach((row) => {
      const ageMonths = toAgeMonths(row.date, now);
      if (ageMonths < 0 || ageMonths >= 12) return;
      const bucketIndex = BUCKETS.findIndex((bucket) => ageMonths >= bucket.minMonths && ageMonths < bucket.maxMonths);
      if (bucketIndex < 0) return;

      const bucket = initial[bucketIndex];
      if (!bucket) return;

      if (row.action === "sell") {
        bucket.soldShares += row.shares;
        bucket.soldValue += row.valueUsd;
        if (row.entityType === "company") bucket.soldCompanies += 1;
        else bucket.soldIndividuals += 1;
      } else {
        bucket.boughtShares += row.shares;
        bucket.boughtValue += row.valueUsd;
        if (row.entityType === "company") bucket.boughtCompanies += 1;
        else bucket.boughtIndividuals += 1;
      }
    });

    return initial;
  }, [data, now]);

  const maxShares = useMemo(() => {
    return aggregates.reduce((max, bucket) => {
      return Math.max(max, bucket.soldShares, bucket.boughtShares);
    }, 0);
  }, [aggregates]);

  const containerStyle: CSSProperties = {
    width: "100%",
    ...(height ? { height } : { height: "100%" }),
  };

  const title = style?.title?.trim();
  const hasData = maxShares > 0;

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent">
      <div className="h-full rounded-md border border-white/15 bg-[#1b1d20] overflow-auto" style={containerStyle}>
        {title ? (
          <div className="px-4 py-2 text-[12px] font-medium text-[#d6d6d6] border-b border-white/10">
            {title}
          </div>
        ) : null}

        <div className="min-w-[820px]">
          <div className="grid grid-cols-[88px_1fr_1fr] border-b border-white/10">
            <div className="px-3 py-3 text-[11px] text-[#9ea3ab]">기간</div>
            <div
              className="px-4 py-3 text-[20px] font-semibold text-[#ff8a2a] border-l border-white/10"
              style={{ background: "linear-gradient(90deg, rgba(63,40,29,0.85), rgba(63,40,29,0.45))" }}
            >
              매도 주식수
            </div>
            <div
              className="px-4 py-3 text-[20px] font-semibold text-[#31d08a] border-l border-white/10"
              style={{ background: "linear-gradient(90deg, rgba(24,55,42,0.45), rgba(24,55,42,0.85))" }}
            >
              매수 주식수
            </div>
          </div>

          {!hasData ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#9ea3ab]">
              최근 12개월 내부자 거래 데이터가 없습니다.
            </div>
          ) : null}

          {aggregates.map((bucket) => (
            <div key={bucket.key} className="grid grid-cols-[88px_1fr_1fr] border-b border-white/10">
              <div className="px-3 py-4 flex flex-col justify-center">
                <span className="text-[28px] leading-none font-semibold text-[#eceff4]">{bucket.label}</span>
                <span className="text-[12px] text-[#9ea3ab] mt-1">개월</span>
              </div>

              <div
                className="relative px-4 py-4 border-l border-white/10 overflow-hidden"
                style={{ background: "linear-gradient(90deg, rgba(59,36,27,0.72), rgba(59,36,27,0.36))" }}
              >
                {bucket.soldShares > 0 ? (
                  <div
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-4 bg-[#ff8a2a]"
                    style={{ width: barWidthPercent(bucket.soldShares, maxShares) }}
                  />
                ) : null}
                <div className="relative z-[1] text-right">
                  <div className={`text-[20px] font-semibold ${bucket.soldShares > 0 ? "text-[#f3f5f7]" : "text-[#818892]"}`}>
                    {formatShares(bucket.soldShares)}
                  </div>
                  {bucket.soldValue > 0 ? (
                    <div className="text-[14px] text-[#bfc5cc]">{formatApproxUsd(bucket.soldValue)}</div>
                  ) : null}
                  <div className="text-[13px] text-[#ffb070] mt-1">
                    개인 {bucket.soldIndividuals}   법인 {bucket.soldCompanies}
                  </div>
                </div>
              </div>

              <div
                className="relative px-4 py-4 border-l border-white/10 overflow-hidden"
                style={{ background: "linear-gradient(90deg, rgba(22,53,42,0.36), rgba(22,53,42,0.72))" }}
              >
                {bucket.boughtShares > 0 ? (
                  <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-4 bg-[#31d08a]"
                    style={{ width: barWidthPercent(bucket.boughtShares, maxShares) }}
                  />
                ) : null}
                <div className="relative z-[1] text-left">
                  <div className={`text-[20px] font-semibold ${bucket.boughtShares > 0 ? "text-[#f3f5f7]" : "text-[#818892]"}`}>
                    {formatShares(bucket.boughtShares)}
                  </div>
                  {bucket.boughtValue > 0 ? (
                    <div className="text-[14px] text-[#bfc5cc]">{formatApproxUsd(bucket.boughtValue)}</div>
                  ) : null}
                  <div className="text-[13px] text-[#76e8ba] mt-1">
                    개인 {bucket.boughtIndividuals}   법인 {bucket.boughtCompanies}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 px-4 py-3 text-[13px] border-t border-white/10 bg-[#1a1c1f]">
            <div className="pr-4 border-r border-white/10">
              <div className="flex items-center gap-2 text-[#f4b079]">
                <span className="w-2 h-2 rounded-full bg-[#ff8a2a]" />
                개인 매도
              </div>
              <div className="flex items-center gap-2 text-[#d09a6a] mt-2">
                <span className="w-2 h-2 rounded-full bg-[#b86624]" />
                법인 매도
              </div>
            </div>
            <div className="pl-4">
              <div className="flex items-center gap-2 text-[#7de4b8]">
                <span className="w-2 h-2 rounded-full bg-[#31d08a]" />
                개인 매수
              </div>
              <div className="flex items-center gap-2 text-[#66caa0] mt-2">
                <span className="w-2 h-2 rounded-full bg-[#19885b]" />
                법인 매수
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
