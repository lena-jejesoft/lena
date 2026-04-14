"use client"

import type { ComponentProps } from "react"
import type { ChartType } from "@/components/chart/types"
import { cn } from "@/lib/utils"

export type ChartTypeIconKey =
  | "line"
  | "column"
  | "stacked-column"
  | "stacked-column-100"
  | "bar"
  | "grouped-bar"
  | "stacked-bar"
  | "area"
  | "stacked-area"
  | "area-100"
  | "pie"
  | "two-level-pie"
  | "scatter"
  | "regression-scatter"
  | "candles"
  | "gauge"
  | "grid"
  | "insider-trading"
  | "treemap"
  | "sankey"
  | "mixed"
  | "dual-axis"
  | "dual-axis-stacked-bar"
  | "value-conversion"
  | "radar"
  | "generic"

type ChartTypeIconProps = {
  iconKey?: ChartTypeIconKey
  chartType?: ChartType
  className?: string
} & Omit<ComponentProps<"svg">, "className">

export function inferChartTypeIconKey(chartType: ChartType): ChartTypeIconKey {
  const value = String(chartType)

  if (value === "candlestick" || value.includes("candles")) return "candles"
  if (value.includes("gauge")) return "gauge"
  if (value.includes("grid")) return "grid"
  if (value.includes("insider")) return "insider-trading"
  if (value.includes("value-conversion")) return "value-conversion"
  if (value.includes("sankey")) return "sankey"
  if (value.includes("treemap")) return "treemap"
  if (value.includes("radar")) return "radar"
  if (value.includes("regression-scatter")) return "regression-scatter"
  if (value.includes("scatter")) return "scatter"
  if (value.includes("two-level-pie")) return "two-level-pie"
  if (value.includes("pie")) return "pie"
  if (value.includes("ownership-stacked")) return "stacked-area"
  if (value.includes("synced-area")) return "stacked-area"
  if (value.includes("area-100")) return "area-100"
  if (value.includes("stacked-area")) return "stacked-area"
  if (value.includes("area")) return "area"
  if (value.includes("dual-axis-stacked-bar")) return "dual-axis-stacked-bar"
  if (value.includes("dual-axis")) return "dual-axis"
  if (value.includes("mixed")) return "mixed"
  if (value.includes("stacked-grouped")) return "stacked-column"
  if (value.includes("stacked-100")) return "stacked-column-100"
  if (value.includes("stacked")) return value.includes("bar") ? "stacked-bar" : "stacked-column"
  if (value.includes("grouped-bar")) return "grouped-bar"
  if (value.includes("ranking-bar")) return "bar"
  if (value === "bar" || value.endsWith("/bar")) return "bar"
  if (value === "column" || value.endsWith("/column")) return "column"
  if (value === "line" || value.endsWith("/line")) return "line"

  return "generic"
}

export function ChartTypeIcon({
  iconKey,
  chartType,
  className,
  ...props
}: ChartTypeIconProps) {
  const resolvedIconKey = iconKey ?? (chartType ? inferChartTypeIconKey(chartType) : "generic")
  const iconClassName = cn("size-4 shrink-0 text-current", className)

  switch (resolvedIconKey) {
    case "line":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <polyline
            points="4,18 8,12 12,15 16,8 20,10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "column":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="10" width="4" height="10" rx="0.75" />
          <rect x="10" y="6" width="4" height="14" rx="0.75" />
          <rect x="16" y="12" width="4" height="8" rx="0.75" />
        </svg>
      )
    case "stacked-column":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="14" width="4" height="6" rx="0.75" />
          <rect x="4" y="8" width="4" height="5" rx="0.75" opacity="0.55" />
          <rect x="10" y="10" width="4" height="10" rx="0.75" />
          <rect x="10" y="4" width="4" height="5" rx="0.75" opacity="0.55" />
          <rect x="16" y="12" width="4" height="8" rx="0.75" />
          <rect x="16" y="6" width="4" height="5" rx="0.75" opacity="0.55" />
        </svg>
      )
    case "stacked-column-100":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="4" width="4" height="16" rx="0.75" />
          <rect x="10" y="4" width="4" height="16" rx="0.75" opacity="0.8" />
          <rect x="16" y="4" width="4" height="16" rx="0.75" opacity="0.6" />
        </svg>
      )
    case "bar":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="4" width="8" height="4" rx="0.75" />
          <rect x="4" y="10" width="13" height="4" rx="0.75" />
          <rect x="4" y="16" width="17" height="4" rx="0.75" />
        </svg>
      )
    case "grouped-bar":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="4" width="10" height="4" rx="0.75" />
          <rect x="4" y="10" width="14" height="4" rx="0.75" />
          <rect x="4" y="16" width="8" height="4" rx="0.75" />
        </svg>
      )
    case "stacked-bar":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="4" width="6" height="4" rx="0.75" />
          <rect x="11" y="4" width="5" height="4" rx="0.75" opacity="0.55" />
          <rect x="4" y="10" width="8" height="4" rx="0.75" />
          <rect x="13" y="10" width="5" height="4" rx="0.75" opacity="0.55" />
          <rect x="4" y="16" width="10" height="4" rx="0.75" />
          <rect x="15" y="16" width="4" height="4" rx="0.75" opacity="0.55" />
        </svg>
      )
    case "area":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <path d="M4 20V13.5L8 11L12 14L16 7.5L20 10.5V20Z" opacity="0.7" />
          <polyline
            points="4,13.5 8,11 12,14 16,7.5 20,10.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "stacked-area":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <path d="M4 20V15L8 12L12 14.5L16 9.5L20 12V20Z" opacity="0.45" />
          <path d="M4 20V13L8 10L12 12L16 7L20 10V20Z" opacity="0.85" />
        </svg>
      )
    case "area-100":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <path d="M4 20V4L8 8L12 5L16 9L20 4V20Z" opacity="0.82" />
        </svg>
      )
    case "pie":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <path d="M12 3.5V12H20.5C20.2 7.2 16.8 3.8 12 3.5Z" fill="currentColor" />
          <path
            d="M10.8 4.1C6.7 4.7 3.5 8.2 3.5 12.5C3.5 17.2 7.3 21 12 21C16.3 21 19.8 17.8 20.4 13.7H10.8Z"
            fill="currentColor"
            opacity="0.55"
          />
        </svg>
      )
    case "two-level-pie":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="3" opacity="0.55" />
          <path d="M12 3.5A8.5 8.5 0 0 1 20.5 12H12Z" fill="currentColor" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.8" />
        </svg>
      )
    case "scatter":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <circle cx="6" cy="16" r="2" />
          <circle cx="10" cy="10" r="2" />
          <circle cx="14" cy="14" r="2" />
          <circle cx="18" cy="8" r="2" />
        </svg>
      )
    case "regression-scatter":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <circle cx="6" cy="16" r="1.8" fill="currentColor" />
          <circle cx="10" cy="11" r="1.8" fill="currentColor" />
          <circle cx="14" cy="13" r="1.8" fill="currentColor" />
          <circle cx="18" cy="8" r="1.8" fill="currentColor" />
          <line
            x1="4"
            y1="18"
            x2="20"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      )
    case "candles":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="5" y="8" width="3" height="8" rx="0.75" />
          <rect x="11" y="5" width="3" height="10" rx="0.75" opacity="0.75" />
          <rect x="17" y="9" width="3" height="7" rx="0.75" />
          <rect x="6.15" y="4" width="0.7" height="4" rx="0.35" />
          <rect x="6.15" y="16" width="0.7" height="4" rx="0.35" />
          <rect x="12.15" y="3" width="0.7" height="2" rx="0.35" />
          <rect x="12.15" y="15" width="0.7" height="5" rx="0.35" />
          <rect x="18.15" y="5" width="0.7" height="4" rx="0.35" />
          <rect x="18.15" y="16" width="0.7" height="4" rx="0.35" />
        </svg>
      )
    case "gauge":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <path
            d="M4 16a8 8 0 0 1 16 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 12l4.5-3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      )
    case "grid":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="5" width="16" height="14" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 10h16M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )
    case "insider-trading":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <path
            d="M6 16.5 10 12.5l3 2 5-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 8.5H18v2.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="4" y="18.5" width="16" height="1.5" rx="0.75" fill="currentColor" opacity="0.35" />
        </svg>
      )
    case "treemap":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="4" width="9" height="7" rx="1" />
          <rect x="14" y="4" width="6" height="12" rx="1" opacity="0.75" />
          <rect x="4" y="12" width="9" height="8" rx="1" opacity="0.6" />
          <rect x="14" y="17" width="6" height="3" rx="1" />
        </svg>
      )
    case "sankey":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="5" width="4" height="5" rx="1" fill="currentColor" />
          <rect x="16" y="4" width="4" height="6" rx="1" fill="currentColor" />
          <rect x="16" y="14" width="4" height="5" rx="1" fill="currentColor" opacity="0.75" />
          <path
            d="M8 7.5c3 0 3.5 0 8 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M8 7.5c3.8 0 4 9 8 9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      )
    case "mixed":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="11" width="3.5" height="9" rx="0.75" fill="currentColor" opacity="0.8" />
          <rect x="10.25" y="8" width="3.5" height="12" rx="0.75" fill="currentColor" opacity="0.45" />
          <polyline
            points="4,8 9,12 14,9 20,5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "dual-axis":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
          <line x1="19" y1="4" x2="19" y2="20" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
          <polyline
            points="6,17 10,11 13,13 18,7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="8" y="14" width="2.6" height="6" rx="0.6" fill="currentColor" opacity="0.7" />
          <rect x="13.2" y="10" width="2.6" height="10" rx="0.6" fill="currentColor" opacity="0.4" />
        </svg>
      )
    case "dual-axis-stacked-bar":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <line x1="4.5" y1="4" x2="4.5" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
          <line x1="19.5" y1="4" x2="19.5" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
          <rect x="6" y="5" width="5" height="3.5" rx="0.75" fill="currentColor" />
          <rect x="11.5" y="5" width="3.5" height="3.5" rx="0.75" fill="currentColor" opacity="0.55" />
          <rect x="6" y="10.25" width="7" height="3.5" rx="0.75" fill="currentColor" />
          <rect x="13.5" y="10.25" width="3.5" height="3.5" rx="0.75" fill="currentColor" opacity="0.55" />
          <polyline
            points="6,18 10,15 14,16 18,11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "value-conversion":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="6" width="6" height="4" rx="1" fill="currentColor" />
          <rect x="14" y="5" width="6" height="5" rx="1" fill="currentColor" opacity="0.75" />
          <rect x="14" y="14" width="6" height="5" rx="1" fill="currentColor" opacity="0.45" />
          <path
            d="M10 8c2.6 0 2.6 0 4 0"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M10 8c2.2 0 2.4 8.5 4 8.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      )
    case "radar":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <path d="M12 4 18.5 8 16 18H8L5.5 8Z" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
          <path d="M12 7 16 9.5 14.5 15H9.5L8 9.5Z" fill="currentColor" opacity="0.75" />
        </svg>
      )
    case "generic":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true" {...props}>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
          <polyline
            points="7,15 10,11 13,13 17,8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}
