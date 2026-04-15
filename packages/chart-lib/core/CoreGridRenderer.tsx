"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { CartesianPoint, ChartData, ChartStyle } from "../types";

type GridRow = Record<string, unknown>;

type GridColumn = {
  key: string;
  label: string;
  align: "left" | "right";
};

const PRIORITY_KEYS = [
  "date",
  "date_display",
  "action",
  "side",
  "value",
  "amount",
  "name",
  "entity",
  "role",
  "shares",
  "max_price",
  "maxPrice",
] as const;

const LABEL_MAP: Record<string, string> = {
  date: "Date",
  date_display: "Date",
  action: "Action",
  side: "Action",
  value: "Value",
  amount: "Value",
  name: "Name",
  entity: "Entity",
  role: "Role",
  shares: "Shares",
  max_price: "Max Price",
  maxPrice: "Max Price",
  x: "Category",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCartesianPoint(value: unknown): value is CartesianPoint {
  if (!isPlainObject(value)) return false;
  return ("x" in value && "y" in value);
}

function isOhlcPoint(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return "open" in value && "high" in value && "low" in value && "close" in value;
}

function normalizeHeader(key: string): string {
  const mapped = LABEL_MAP[key];
  if (mapped) return mapped;
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isDateLikeKey(key: string): boolean {
  return key === "date" || key === "date_display" || key.endsWith("_date");
}

function formatDateLabel(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const source = String(value);
  if (typeof value === "string" && !/[0-9]{2,4}/.test(source)) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(parsed);
}

function formatCellValue(key: string, value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    return value.toLocaleString("en-US");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (isDateLikeKey(key)) {
    const dateLabel = formatDateLabel(value);
    if (dateLabel) return dateLabel;
  }
  return String(value);
}

function isNumeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isActionValue(value: unknown): value is "buy" | "sell" {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "buy" || normalized === "sell";
}

function buildColumns(rows: GridRow[]): GridColumn[] {
  const seen = new Set<string>();
  const discovered: string[] = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      discovered.push(key);
    }
  }

  const priority = PRIORITY_KEYS.filter((key) => seen.has(key));
  const rest = discovered.filter((key) => !PRIORITY_KEYS.includes(key as (typeof PRIORITY_KEYS)[number]));
  const ordered = [...priority, ...rest];

  return ordered.map((key) => {
    const align = rows.some((row) => isNumeric(row[key])) ? "right" : "left";
    return {
      key,
      label: normalizeHeader(key),
      align,
    };
  });
}

function toGridRowsFromObjects(data: ChartData): GridRow[] {
  const rows: GridRow[] = [];

  for (const series of data.series) {
    for (const point of series.data as unknown[]) {
      if (!isPlainObject(point)) continue;
      if (isCartesianPoint(point) || isOhlcPoint(point)) continue;
      rows.push(point);
    }
  }

  return rows;
}

function toGridRowsFromSeries(data: ChartData): GridRow[] {
  const rowOrder: string[] = [];
  const rowMap = new Map<string, GridRow>();
  const xLabel = data.xAxisType === "datetime" ? "date" : "x";

  for (const series of data.series) {
    for (const point of series.data) {
      const cartesian = point as CartesianPoint;
      if (typeof cartesian?.y !== "number") continue;

      const rawKey = cartesian.x;
      const rowKey = typeof rawKey === "number" ? String(rawKey) : String(rawKey ?? "");
      if (!rowMap.has(rowKey)) {
        rowOrder.push(rowKey);
        rowMap.set(rowKey, {
          [xLabel]: data.xAxisType === "datetime" ? formatDateLabel(rawKey) ?? rowKey : rowKey,
        });
      }

      const row = rowMap.get(rowKey);
      if (!row) continue;
      row[series.name] = cartesian.y;
    }
  }

  return rowOrder.map((key) => rowMap.get(key) ?? {});
}

export function CoreGridRenderer({
  data,
  style,
  height,
}: {
  data: ChartData;
  style?: ChartStyle;
  height?: number;
}) {
  const rows = useMemo(() => {
    const objectRows = toGridRowsFromObjects(data);
    if (objectRows.length > 0) return objectRows;
    return toGridRowsFromSeries(data);
  }, [data]);

  const columns = useMemo(() => buildColumns(rows), [rows]);
  const title = style?.title?.trim();

  const containerStyle: CSSProperties = {
    width: "100%",
    ...(height ? { height } : { height: "100%" }),
  };

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent">
      <div
        className="h-full rounded-md border border-white/12 bg-[#1f1f1f] overflow-auto"
        style={containerStyle}
      >
        {title ? (
          <div className="px-4 py-2 text-[12px] font-medium text-[#c9c9c9] border-b border-white/8">
            {title}
          </div>
        ) : null}

        <table className="w-full min-w-[760px] border-collapse text-[13px] text-[#e9e9e9]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`sticky top-0 z-[1] px-4 py-3 text-[12px] font-semibold text-[#dedede] bg-[#3a3a3a] border-b border-white/15 border-r border-white/10 whitespace-nowrap ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={`row-${rowIndex}`}
                className="border-b border-white/10 hover:bg-white/5 transition-colors"
              >
                {columns.map((column) => {
                  const raw = row[column.key];
                  const isAction = isActionValue(raw);
                  const actionColor = typeof raw === "string" && raw.toLowerCase() === "buy"
                    ? "text-[#17d58d] border-[#17d58d]/45 bg-[#17d58d]/10"
                    : "text-[#f38a2a] border-[#f38a2a]/45 bg-[#f38a2a]/10";
                  const text = formatCellValue(column.key, raw);

                  return (
                    <td
                      key={`${rowIndex}-${column.key}`}
                      className={`px-4 py-3 border-r border-white/10 whitespace-nowrap ${
                        column.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {isAction ? (
                        <span className={`inline-block px-2 py-0.5 rounded border text-[12px] leading-tight ${actionColor}`}>
                          {String(raw)}
                        </span>
                      ) : (
                        text || "-"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
