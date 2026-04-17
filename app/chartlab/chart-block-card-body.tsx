"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Page, Panel, PanelBody, PanelHeader } from "@/components/layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataChart } from "@/packages/chart-lib/DataChart"
import type { CartesianStyle, ChartCoreLegendMeta, ChartData, ChartStyle, ChartType, OHLCPoint, Scenario } from "@/packages/chart-lib/types"
import { getCompatibleChartTypes } from "@/packages/chart-lib/registry"
import { SeriesPanelContent } from "@/packages/chart-lib/panels/SeriesPanel"
import { StylePanelContent } from "@/packages/chart-lib/panels/StylePanel"
import {
  type AnalysisRow,
  LINE_LIKE_SERIES_CONTROL_TYPES,
  TREEMAP_SERIES_CONTROL_TYPES,
  PIE_SERIES_CONTROL_TYPES,
  LEGEND_PANEL_SUPPORTED_TYPES,
  isOhlcPoint,
  isOhlcChartData,
  toSeriesRows,
  resolveCoreType,
  getSeriesControlMode,
  isLegendPanelChartType,
  getEnabledSeriesMap,
  getChartCoreLegendMetaSignature,
  getLegendStateSignature,
  BASE_PALETTE,
  hasRenderableSeries,
  isOutlierSupported,
  getOutlierCount,
  getSeriesDisplayColors,
  getAnalysisResultForSeries,
  applyViewStateToStyle,
} from "@/packages/chart-lib/utils/chart-helpers"
import type { ChartBlock } from "@/packages/chart-lib/types"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { ChevronsLeft, ChevronsRight } from "lucide-react"
import { BlendedChartViewProvider, useBlendedChartViewContext } from "./page-h-context"
import { PageHDbDialog } from "./page-h-db"
import {
  appendRows,
  buildChartDataFromRows,
  buildJoinPreview,
  buildOhlcChartData,
  buildOhlcSeriesFromRows,
  BLEND_MAPPING_HEADER_TIME_KEY,
  BLEND_MAPPING_HEADER_VALUE_KEY,
  HEADER_ROW_X_KEY,
  extractUploadData,
  inferBlendSemanticMapping,
  isOhlcLikeSource,
  isPeriodLikeColumnName,
  joinRows,
  mapMetricRowsToPreviewRows,
  mapOhlcvRowsToPreviewRows,
  normalizeSourceRowsForBlend,
  type BlendSemanticMapping,
  type JoinPreview,
  type JoinType,
} from "./page-h-adapters"
import type {
  PageHDbCompanyOption,
  PageHDbDimensionKey,
  PageHDbMetricKey,
  PageHDbOption,
  PageHDbPreviewRow,
  PageHDbQueryMode,
} from "./page-h-db"
import type { BlendedChartViewState } from "./page-h-types"
import { CHART_TYPE_OPTIONS, type ChartTypeOption } from "@/packages/chart-lib/chart-type-options"
import { ChartTypeIcon, inferChartTypeIconKey } from "@/packages/chart-lib/chart-type-icon"
import {
  fetchCompanyMetricCatalog,
  fetchCompanyMetricRows,
  fetchCompanyOhlcvRows,
  type CompanyMetricCatalogItem,
  type MetricDimension,
  type MetricEntitySource,
} from "./query"
import {
  fetchMockSectorbookCompanies,
  fetchMockSectorbookMetricCatalog,
  fetchMockSectorbookMetricRows,
  fetchMockSectorbookOhlcvRows,
} from "./mock-sectorbook-provider"
import { PageHHierarchyPanel } from "./page-h-hierarchy-panel"
import { buildChartDataFromHierarchySeries, buildHierarchySourceNodes } from "./page-h-hierarchy-adapter"
import { usePageHHierarchyState } from "./page-h-hierarchy-state"
import type { HierarchySelectedMetric } from "./page-h-hierarchy-types"
import { PageHDerivedPanel } from "./page-h-derived-panel"
import {
  computeDerivedMetricSeries,
  DERIVED_FORMULA_PRESETS,
  formatDerivedBlendMessage,
  getDerivedFormulaPreset,
} from "./page-h-derived-adapter"
import { usePageHDerivedState } from "./page-h-derived-state"
import type { DerivedFormulaId } from "./page-h-derived-types"
import { PageHUploadAxisPanel } from "./page-h-upload-axis-panel"
import {
  recommendQuickInputFromMock,
  type QuickInputRecommendation,
} from "./page-h-quick-input-recommender"
import { SeriesAdditionPanel } from "./series-addition-panel"

type BlendedChartBlock = ChartBlock & {
  title: string
  description: string
}

type BlendedLegendState = {
  tooltipPayload: any[] | null
  hoveredLabel: string | null
  treemapStats?: any
  chartCoreLegendMeta?: ChartCoreLegendMeta | null
}

type UploadSlotId = "A" | "B"

type DbPreviewData = {
  columns: string[]
  rows: PageHDbPreviewRow[]
  companyName: string
}

type DbSlotSelection = {
  companyId: string
  queryMode: PageHDbQueryMode
  metricKey: PageHDbMetricKey
  dimensionKey: PageHDbDimensionKey
}

type DbMetricCatalogItem = {
  metricKey: PageHDbMetricKey
  metricTypeId: string
  metricName: string
  label: string
  unit?: string
  entitySource: MetricEntitySource
  dimensions: MetricDimension[]
  hierarchyPath?: string[]
}

type QuickMetricItemRow = {
  ts_date: string
  value: number | string
  dimension_key: string | null
  metadata: Record<string, unknown> | null
}

type QuickParsedIntent = {
  entityName: string
  metricQuery: string
  lookbackYears: number
  periodMode: "auto" | MetricDimension
  chartType: ChartType | null
}

type QuickIntentApiResponse = {
  entityName?: string | null
  metricName?: string | null
  lookbackYears?: number
  periodMode?: "auto" | "yearly" | "quarterly" | "monthly" | "daily"
  chartType?: "bar" | "line" | "area" | "pie" | "column" | null
  needsClarification?: boolean
  confidence?: number
  reason?: string | null
}

type UploadedSource = {
  slot: UploadSlotId
  fileName: string
  fileSize: number
  mimeType: string
  columns: string[]
  rowCount: number | null
  rows: Array<Record<string, string | number | null>>
  uploadedAt: number
}

function ChartTypeSelectLabel({
  option,
  disabled = false,
}: {
  option: Pick<ChartTypeOption, "label" | "iconKey">
  disabled?: boolean
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", disabled && "opacity-60")}>
      <ChartTypeIcon iconKey={option.iconKey} className="size-5" />
      <span className="truncate">{option.label}</span>
    </span>
  )
}

type UploadAxisSelection = {
  xKey: string
  yKeys: string[]
}

type BlendSemanticMappingBySlot = Record<UploadSlotId, BlendSemanticMapping>
type BlendSemanticField = keyof BlendSemanticMapping

const JOIN_TYPE_LABELS: Record<JoinType, string> = {
  append: "시리즈 병합 (A+B)",
  left: "Left join (A 기준)",
  inner: "Inner join",
  full: "Full outer join",
  right: "Right join (B 기준)",
}

const JOIN_TYPE_DESCRIPTIONS: Record<JoinType, string> = {
  append: "A/B 행을 그대로 이어 붙여 같은 차트 축에서 시리즈로 함께 보여줍니다.",
  left: "A의 모든 행을 유지하고 B는 매칭되는 행만 결합합니다.",
  inner: "A/B 모두 매칭되는 행만 결합합니다.",
  full: "A/B의 모든 행을 유지해 결합합니다.",
  right: "B의 모든 행을 유지하고 A는 매칭되는 행만 결합합니다.",
}

const DB_AUTO_DIMENSION_OPTION: PageHDbOption = { value: "auto", label: "자동" }

const DB_DIMENSION_OPTIONS: PageHDbOption[] = [
  { value: "daily", label: "일간" },
  { value: "monthly", label: "월간" },
  { value: "quarterly", label: "분기" },
  { value: "yearly", label: "연간" },
]

const DB_METRIC_VALUE_COLUMNS: string[] = ["ts_date", "value"]
const DB_OHLCV_COLUMNS: string[] = ["ts_date", "open", "high", "low", "close", "volume", "turnover"]
// 프론트 구현 단계에서는 DB 대신 mock sectorbook provider를 사용한다.
// 필요 시 false로 전환하면 기존 Supabase 조회 경로를 그대로 재사용한다.
const USE_MOCK_SECTORBOOK_PROVIDER = true
const QUICK_PERIOD_PRIORITY: MetricDimension[] = ["yearly", "quarterly", "monthly", "daily"]
const QUICK_DEFAULT_LOOKBACK_YEARS = 5
const QUICK_MAX_LOOKBACK_YEARS = 20
const MOCK_QUICK_INPUT_DEFAULT = "삼성증권 매출"
const AXIS_X_KEY_LABEL_MAP: Record<string, string> = {
  [HEADER_ROW_X_KEY]: "첫번째 row(컬럼명)",
}
const BLEND_MAPPING_TIME_LABEL_MAP: Record<string, string> = {
  [BLEND_MAPPING_HEADER_TIME_KEY]: "헤더(기간 컬럼)",
}
const BLEND_MAPPING_VALUE_LABEL_MAP: Record<string, string> = {
  [BLEND_MAPPING_HEADER_VALUE_KEY]: "헤더 값(자동)",
}

const SAMPLE_BLOCKS: BlendedChartBlock[] = [
  {
    id: "chart-1",
    title: "",
    description: "",
    chartType: "chartCore/line",
    data: { xAxisType: "category", series: [] },
    style: { legend: { position: "none" }, tooltip: { shared: true }, colorPalette: BASE_PALETTE },
  },
]

function parseQuickChartType(value: string): ChartType | null {
  const normalized = value.toLowerCase()
  if (/바\s*차트|막대|bar/.test(normalized)) return "chartCore/column"
  if (/라인|선\s*차트|line/.test(normalized)) return "chartCore/line"
  if (/영역|area/.test(normalized)) return "chartCore/area"
  if (/파이|원형|pie/.test(normalized)) return "chartCore/pie"
  return null
}

function parseQuickPeriodMode(value: string): "auto" | MetricDimension {
  const normalized = value.toLowerCase()
  if (/분기|quarter|qtr/.test(normalized)) return "quarterly"
  if (/월간|월별|monthly/.test(normalized)) return "monthly"
  if (/일간|일별|daily/.test(normalized)) return "daily"
  if (/연간|연도별|yearly|annual/.test(normalized)) return "yearly"
  return "auto"
}

function sanitizeQuickEntityName(value: string): string {
  return value
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sanitizeQuickMetricQuery(value: string): string {
  return value
    .replace(/(지난|최근)\s*\d+\s*(년|개년)(간)?/g, " ")
    .replace(/\d+\s*(년|개년)(간)?/g, " ")
    .replace(/(연간|연도별|분기|분기별|월간|월별|일간|일별)/g, " ")
    .replace(/(바\s*차트|라인\s*차트|선\s*차트|영역\s*차트|파이\s*차트|bar|line|area|pie)/gi, " ")
    .replace(/(보여줘|보여주세요|조회해줘|조회해|조회|출력해줘|출력|그래프로|그래프|차트로|차트|그려줘|그려주세요|부탁해|해줘|해주세요|좀|데이터|추이)/g, " ")
    .replace(/[?!.]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(을|를|이|가|은|는)$/g, "")
    .trim()
}

function parseQuickLookbackYears(value: string): number {
  const matched = value.match(/(\d+)\s*(년|개년)/)
  if (!matched) return QUICK_DEFAULT_LOOKBACK_YEARS
  const parsed = Number(matched[1])
  if (!Number.isFinite(parsed) || parsed <= 0) return QUICK_DEFAULT_LOOKBACK_YEARS
  return Math.min(Math.max(1, Math.floor(parsed)), QUICK_MAX_LOOKBACK_YEARS)
}

function parseQuickIntent(value: string): QuickParsedIntent {
  const normalized = value.replace(/\s+/g, " ").trim()
  const markerIndex = normalized.indexOf("의")
  let rawEntity = ""
  let rawMetric = normalized

  if (markerIndex > 0) {
    rawEntity = normalized.slice(0, markerIndex).trim()
    rawMetric = normalized.slice(markerIndex + 1).trim()
  } else {
    const tokens = normalized.split(" ").filter(Boolean)
    if (tokens.length >= 2) {
      rawEntity = tokens[0] ?? ""
      rawMetric = tokens.slice(1).join(" ")
    } else {
      rawEntity = normalized
      rawMetric = ""
    }
  }

  return {
    entityName: sanitizeQuickEntityName(rawEntity),
    metricQuery: sanitizeQuickMetricQuery(rawMetric),
    lookbackYears: parseQuickLookbackYears(normalized),
    periodMode: parseQuickPeriodMode(normalized),
    chartType: parseQuickChartType(normalized),
  }
}

function normalizeMetricText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]{}\-_/\\.,:;'"`~!?]/g, " ")
    .replace(/\s+/g, "")
    .trim()
}

function getEditDistance(source: string, target: string): number {
  if (source === target) return 0
  if (!source.length) return target.length
  if (!target.length) return source.length

  const rows = source.length + 1
  const cols = target.length + 1
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i += 1) {
    matrix[i]![0] = i
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0]![j] = j
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + substitutionCost
      )
    }
  }

  return matrix[rows - 1]![cols - 1]!
}

function getTextSimilarity(sourceValue: string, targetValue: string): number {
  const source = normalizeMetricText(sourceValue)
  const target = normalizeMetricText(targetValue)
  if (!source || !target) return 0
  if (source === target) return 1

  const maxLength = Math.max(source.length, target.length)
  let best = 1 - getEditDistance(source, target) / maxLength

  if (source.includes(target) || target.includes(source)) {
    const overlap = Math.min(source.length, target.length) / maxLength
    best = Math.max(best, overlap)
  }

  // 긴 문자열 안의 부분 문자열과도 비교해 1~2글자 오타를 보정한다. (예: 메출 -> 매출액)
  const shorterLength = Math.min(source.length, target.length)
  if (shorterLength >= 2) {
    const longer = source.length >= target.length ? source : target
    const shorter = source.length >= target.length ? target : source
    for (let i = 0; i <= longer.length - shorterLength; i += 1) {
      const fragment = longer.slice(i, i + shorterLength)
      const fragmentScore = 1 - getEditDistance(fragment, shorter) / shorterLength
      if (fragmentScore > best) {
        best = fragmentScore
      }
    }
  }

  return Math.max(0, Math.min(1, best))
}

function scoreQuickMetric(metric: DbMetricCatalogItem, query: string): number {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return 0
  const metricLabel = metric.label.toLowerCase()
  const metricName = metric.metricName.toLowerCase()

  let score = 0
  if (metricLabel === normalized) score += 120
  if (metricName === normalized) score += 100
  if (metricLabel.startsWith(normalized)) score += 40
  if (metricName.startsWith(normalized)) score += 30
  if (metricLabel.includes(normalized)) score += 20
  if (metricName.includes(normalized)) score += 15
  if (metric.metricName.startsWith("dart:summary:")) score += 10

  const similarity = Math.max(
    getTextSimilarity(metric.label, query),
    getTextSimilarity(metric.metricName, query)
  )
  const fuzzyThreshold = normalized.length <= 2 ? 0.5 : normalized.length <= 4 ? 0.42 : 0.35
  if (similarity >= fuzzyThreshold) {
    score += Math.round(similarity * 60)
  }
  if (similarity >= 0.85) {
    score += 20
  }

  return score
}

function getQuickStartDate(latestDate: string, lookbackYears: number): string {
  const base = new Date(`${latestDate}T00:00:00`)
  const startYear = base.getFullYear() - lookbackYears + 1
  return `${startYear}-01-01`
}

function formatQuickPeriodLabel(periodType: MetricDimension, row: QuickMetricItemRow): string {
  const year = row.ts_date.slice(0, 4)
  if (periodType === "yearly") return year
  if (periodType === "quarterly") {
    const quarter = row.metadata?.fiscal_quarter
    const q = typeof quarter === "number" ? quarter : Number(quarter)
    if (Number.isFinite(q) && q >= 1 && q <= 4) return `${year}-Q${q}`
    const month = Number(row.ts_date.slice(5, 7))
    const monthToQuarter: Record<number, number> = { 3: 1, 6: 2, 9: 3, 12: 4 }
    const fallbackQuarter = monthToQuarter[month]
    return fallbackQuarter ? `${year}-Q${fallbackQuarter}` : row.ts_date
  }
  if (periodType === "monthly") return row.ts_date.slice(0, 7)
  return row.ts_date
}

function formatQuickPeriodType(periodType: MetricDimension): string {
  if (periodType === "yearly") return "연간"
  if (periodType === "quarterly") return "분기"
  if (periodType === "monthly") return "월간"
  return "일간"
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-"
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%"
  return `${(value * 100).toFixed(1)}%`
}

function hasFiniteNumberValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isSameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function getNumericColumnsFromRows(
  rows: Array<Record<string, string | number | null>>,
  columns: string[],
  excludedColumns: string[] = []
): string[] {
  const excluded = new Set(excludedColumns)
  return columns.filter((column) => {
    if (excluded.has(column)) return false
    return rows.some((row) => hasFiniteNumberValue(row[column]))
  })
}

function getSelectableColumns(
  columns: string[],
  excludedColumns: string[] = []
): string[] {
  const excluded = new Set(excludedColumns)
  return columns.filter((column) => !excluded.has(column))
}

function withHeaderRowXAxisOption(columns: string[]): string[] {
  return [HEADER_ROW_X_KEY, ...columns]
}

function isDateHeaderColumnName(value: string): boolean {
  return isPeriodLikeColumnName(value)
}

function hasPeriodHeaderColumns(columns: string[]): boolean {
  return columns.filter((column) => isPeriodLikeColumnName(column)).length >= 2
}

function resolveDefaultXKey(
  columns: string[],
  rows: Array<Record<string, string | number | null>> = []
): string {
  if (columns.includes("ts_date")) return "ts_date"
  const dateHeaderColumns = columns.filter((column) => isDateHeaderColumnName(column))
  if (dateHeaderColumns.length >= 2) {
    const nonDateColumns = columns.filter((column) => !isDateHeaderColumnName(column))
    if (nonDateColumns.length === 0) return columns[0] ?? ""
    if (rows.length === 0) return nonDateColumns[0]!

    let bestColumn = nonDateColumns[0]!
    let bestDistinctCount = -1
    nonDateColumns.forEach((column) => {
      const distinctValues = new Set(
        rows
          .map((row) => String(row[column] ?? "").trim())
          .filter((value) => value.length > 0)
      )
      if (distinctValues.size > bestDistinctCount) {
        bestDistinctCount = distinctValues.size
        bestColumn = column
      }
    })
    return bestColumn
  }
  return columns[0] ?? ""
}

function resolveDefaultYKeys(
  rows: Array<Record<string, string | number | null>>,
  columns: string[],
  xKey: string
): string[] {
  const candidates = getSelectableColumns(columns, [xKey])
  if (candidates.length === 0) return []
  if (candidates.length > 0 && candidates.every((column) => isDateHeaderColumnName(column))) {
    return candidates
  }
  const numericCandidates = getNumericColumnsFromRows(rows, candidates)
  if (numericCandidates.length > 0) {
    return numericCandidates.slice(0, 2)
  }
  return candidates.slice(0, 2)
}

function normalizeSingleAxisSelection(
  rows: Array<Record<string, string | number | null>>,
  columns: string[],
  selection: UploadAxisSelection
): UploadAxisSelection {
  const axisXOptions = withHeaderRowXAxisOption(columns)
  const nextXKey = axisXOptions.includes(selection.xKey) ? selection.xKey : resolveDefaultXKey(columns, rows)
  const yCandidates = getSelectableColumns(columns, [nextXKey])
  const nextYKeys = selection.yKeys.filter((column) => yCandidates.includes(column))
  if (nextYKeys.length > 0) {
    return { xKey: nextXKey, yKeys: nextYKeys }
  }
  return {
    xKey: nextXKey,
    yKeys: resolveDefaultYKeys(rows, columns, nextXKey),
  }
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getDefaultDbDateRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  }
}

function createDefaultDbSlotSelection(): DbSlotSelection {
  return {
    companyId: "",
    queryMode: "ohlcv",
    metricKey: "",
    dimensionKey: "daily",
  }
}

function createEmptyUploadAxisSelection(): UploadAxisSelection {
  return {
    xKey: "",
    yKeys: [],
  }
}

function createEmptyBlendSemanticMapping(): BlendSemanticMapping {
  return {
    entityColumn: "",
    timeColumn: "",
    metricColumn: "",
    valueColumn: "",
  }
}

function isValidBlendSemanticValue(value: string, columns: string[]): boolean {
  if (!value) return false
  if (value === BLEND_MAPPING_HEADER_TIME_KEY || value === BLEND_MAPPING_HEADER_VALUE_KEY) return true
  return columns.includes(value)
}

function normalizeBlendSemanticMapping(
  rows: Array<Record<string, string | number | null>>,
  columns: string[],
  selection: BlendSemanticMapping
): BlendSemanticMapping {
  const inferred = inferBlendSemanticMapping(rows, columns)
  return {
    entityColumn: isValidBlendSemanticValue(selection.entityColumn, columns) ? selection.entityColumn : inferred.entityColumn,
    timeColumn: isValidBlendSemanticValue(selection.timeColumn, columns) ? selection.timeColumn : inferred.timeColumn,
    metricColumn: isValidBlendSemanticValue(selection.metricColumn, columns) ? selection.metricColumn : inferred.metricColumn,
    valueColumn: isValidBlendSemanticValue(selection.valueColumn, columns) ? selection.valueColumn : inferred.valueColumn,
  }
}

function mapCatalogItems(items: CompanyMetricCatalogItem[]): DbMetricCatalogItem[] {
  return items.map((item) => ({
    metricKey: item.metricTypeId,
    metricTypeId: item.metricTypeId,
    metricName: item.metricName,
    label: item.metricLabel,
    unit: item.unit,
    entitySource: item.entitySource,
    dimensions: item.dimensions,
    hierarchyPath: item.hierarchyPath,
  }))
}

function resolveDimensionForMetric(
  metric: DbMetricCatalogItem | null,
  preferred: PageHDbDimensionKey
): PageHDbDimensionKey {
  if (!metric || metric.dimensions.length === 0) {
    return "auto"
  }
  if (preferred !== "auto" && metric.dimensions.includes(preferred as MetricDimension)) {
    return preferred
  }
  return metric.dimensions[0] as PageHDbDimensionKey
}

function ChartLegendOverlay({
  block,
  colorMap,
  chartCoreLegendMeta,
}: {
  block: BlendedChartBlock
  colorMap: Record<string, string>
  chartCoreLegendMeta?: ChartCoreLegendMeta | null
}) {
  const hasGroupedLegend = Boolean(chartCoreLegendMeta && chartCoreLegendMeta.groups.length > 0)

  return (
    <div className="absolute right-3 top-3 z-20 rounded-md border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="space-y-1">
        {hasGroupedLegend
          ? chartCoreLegendMeta!.groups.map((group, groupIdx) => {
            const groupColor = group.color ?? BASE_PALETTE[groupIdx % BASE_PALETTE.length] ?? BASE_PALETTE[0]
            return (
              <div key={`group-${group.id}-${groupIdx}`} className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: groupColor }} />
                  <span className="truncate">{group.label}</span>
                </div>
                <div className="ml-4 space-y-1">
                  {group.series.map((series, seriesIdx) => {
                    const seriesColor =
                      series.color ??
                      colorMap[series.id] ??
                      groupColor ??
                      BASE_PALETTE[seriesIdx % BASE_PALETTE.length] ??
                      BASE_PALETTE[0]
                    return (
                      <div key={`group-series-${group.id}-${series.id}-${seriesIdx}`} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: seriesColor }} />
                        <span className="truncate text-muted-foreground">{series.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
          : block.data.series.map((series) => (
            <div key={series.id} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorMap[series.id] }} />
              <span>{series.name}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

function Phase3Screen() {
  const { ensureChartState, getChartState, setShowOutliers, setShowTooltip, setShowLegend, setSeriesColor, removeSeriesColor, setGroupColor, removeGroupColor } = useBlendedChartViewContext()
  const supabase = useMemo(() => createClient(), [])
  const [activeChartId, setActiveChartId] = useState<string>(SAMPLE_BLOCKS[0]?.id ?? "")
  const [sideTab, setSideTab] = useState<"data" | "series" | "style">("data")
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false)
  const [showSemanticMappingPanel, setShowSemanticMappingPanel] = useState(true)
  const {
    state: hierarchyState,
    setCompanyId: setHierarchyCompanyId,
    setCompanySearchTerm: setHierarchyCompanySearchTerm,
    setMetricSearchTerm: setHierarchyMetricSearchTerm,
    setDimensionKey: setHierarchyDimensionKey,
    toggleMetricSelection: toggleHierarchyMetricSelection,
    removeMetricSelection: removeHierarchyMetricSelection,
    clearMetricSelections: clearHierarchyMetricSelections,
    pruneUnavailableMetrics: pruneHierarchyUnavailableMetrics,
  } = usePageHHierarchyState()
  const [hierarchyCompanies, setHierarchyCompanies] = useState<PageHDbCompanyOption[]>([])
  const [hierarchyMetrics, setHierarchyMetrics] = useState<DbMetricCatalogItem[]>([])
  const [isHierarchyCompaniesLoading, setIsHierarchyCompaniesLoading] = useState(false)
  const [isHierarchyMetricsLoading, setIsHierarchyMetricsLoading] = useState(false)
  const [isHierarchyApplyLoading, setIsHierarchyApplyLoading] = useState(false)
  const [hierarchyError, setHierarchyError] = useState<string | null>(null)
  const {
    state: derivedState,
    setFormulaId: setDerivedFormulaId,
    setPrimaryMetricKey: setDerivedPrimaryMetricKey,
    setSecondaryMetricKey: setDerivedSecondaryMetricKey,
    setCustomName: setDerivedCustomName,
    reset: resetDerivedState,
    pruneUnavailableMetrics: pruneDerivedUnavailableMetrics,
  } = usePageHDerivedState()
  const [derivedError, setDerivedError] = useState<string | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadTargetSlot, setUploadTargetSlot] = useState<UploadSlotId>("A")
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [quickInputDialogOpen, setQuickInputDialogOpen] = useState(false)
  const [quickInputValue, setQuickInputValue] = useState("")
  const [quickInputError, setQuickInputError] = useState<string | null>(null)
  const [quickInputLoading, setQuickInputLoading] = useState(false)
  const [quickInputRecommendations, setQuickInputRecommendations] = useState<QuickInputRecommendation[]>([])
  const [quickInputRecommendLoading, setQuickInputRecommendLoading] = useState(false)
  const [quickInputRecommendError, setQuickInputRecommendError] = useState<string | null>(null)
  const [dbDialogOpen, setDbDialogOpen] = useState(false)
  const [dbTargetSlot, setDbTargetSlot] = useState<UploadSlotId>("A")
  const [dbSearchTerm, setDbSearchTerm] = useState("")
  const [dbCompanies, setDbCompanies] = useState<PageHDbCompanyOption[]>([])
  const [dbMetricCatalogBySlot, setDbMetricCatalogBySlot] = useState<Partial<Record<UploadSlotId, DbMetricCatalogItem[]>>>({})
  const [dbSelectionBySlot, setDbSelectionBySlot] = useState<Record<UploadSlotId, DbSlotSelection>>({
    A: createDefaultDbSlotSelection(),
    B: createDefaultDbSlotSelection(),
  })
  const [dbDateRange, setDbDateRange] = useState(() => getDefaultDbDateRange())
  const [dbPreviewBySlot, setDbPreviewBySlot] = useState<Partial<Record<UploadSlotId, DbPreviewData>>>({})
  const [isDbCompaniesLoading, setIsDbCompaniesLoading] = useState(false)
  const [isDbMetricsLoading, setIsDbMetricsLoading] = useState(false)
  const [isDbPreviewLoading, setIsDbPreviewLoading] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [uploadedSources, setUploadedSources] = useState<Partial<Record<UploadSlotId, UploadedSource>>>({})
  const [semanticMappingBySlot, setSemanticMappingBySlot] = useState<BlendSemanticMappingBySlot>({
    A: createEmptyBlendSemanticMapping(),
    B: createEmptyBlendSemanticMapping(),
  })
  const [singleAxisBySlot, setSingleAxisBySlot] = useState<Record<UploadSlotId, UploadAxisSelection>>({
    A: createEmptyUploadAxisSelection(),
    B: createEmptyUploadAxisSelection(),
  })
  const [appendAxisSelection, setAppendAxisSelection] = useState<{ xKey: string; yKeys: string[] }>({
    xKey: "",
    yKeys: [],
  })
  const [joinAxisSelection, setJoinAxisSelection] = useState<{ xKey: string; yKeys: string[] }>({
    xKey: "",
    yKeys: [],
  })
  const [joinType, setJoinType] = useState<JoinType>("left")
  const [joinKey, setJoinKey] = useState("")
  const [blendMessage, setBlendMessage] = useState<string | null>(null)
  const [joinPreview, setJoinPreview] = useState<JoinPreview | null>(null)
  const [blocks, setBlocks] = useState<BlendedChartBlock[]>(SAMPLE_BLOCKS)
  const [legendStateByChartId, setLegendStateByChartId] = useState<Record<string, BlendedLegendState>>({})
  const [chartCoreLegendContainer, setChartCoreLegendContainer] = useState<HTMLElement | null>(null)
  const [chartTypeSelectOpen, setChartTypeSelectOpen] = useState(false)
  const [chartTypeSelectMaxHeight, setChartTypeSelectMaxHeight] = useState<number | null>(null)
  const [derivedSectionElement, setDerivedSectionElement] = useState<HTMLElement | null>(null)
  const chartTypeSelectContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // 차트별로 독립 상태를 선생성해 패널 간 즉시 동기화를 보장한다.
    blocks.forEach((block) => {
      ensureChartState(block.id, {
        showOutliers:
          block.style.chartCore?.showOutliers ??
          (block.style as any).timepointLine?.showOutliers ??
          true,
        showTooltip: block.style.tooltip?.shared !== false,
        showLegend: true,
      })
    })
  }, [blocks, ensureChartState])

  useEffect(() => {
    if (!quickInputDialogOpen) return
    setQuickInputValue(USE_MOCK_SECTORBOOK_PROVIDER ? MOCK_QUICK_INPUT_DEFAULT : "")
    setQuickInputError(null)
    setQuickInputRecommendations([])
    setQuickInputRecommendLoading(false)
    setQuickInputRecommendError(null)
  }, [quickInputDialogOpen])

  useEffect(() => {
    if (!USE_MOCK_SECTORBOOK_PROVIDER || !quickInputDialogOpen) return

    const query = quickInputValue.trim()
    if (!query) {
      setQuickInputRecommendations([])
      setQuickInputRecommendError(null)
      setQuickInputRecommendLoading(false)
      return
    }

    let isCancelled = false
    setQuickInputRecommendLoading(true)
    setQuickInputRecommendError(null)

    void recommendQuickInputFromMock({ query, limit: 3 })
      .then((response) => {
        if (isCancelled) return
        if (response.error) {
          setQuickInputRecommendations([])
          setQuickInputRecommendError(response.error)
          return
        }
        setQuickInputRecommendations(response.items)
      })
      .catch(() => {
        if (isCancelled) return
        setQuickInputRecommendations([])
        setQuickInputRecommendError("추천 지표를 조회하는 중 오류가 발생했습니다.")
      })
      .finally(() => {
        if (isCancelled) return
        setQuickInputRecommendLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [quickInputDialogOpen, quickInputValue])

  const activeBlock = useMemo(
    () => blocks.find((block) => block.id === activeChartId) ?? blocks[0],
    [activeChartId, blocks]
  )
  const isSidePanelOpen = !isSidePanelCollapsed
  const chartHeaderTitleOffset = isSidePanelOpen ? 0 : 40
  const isActiveChartCoreType = String(activeBlock?.chartType ?? "").startsWith("chartCore/")
  const allowedChartTypes = useMemo(
    () => CHART_TYPE_OPTIONS.map((option) => option.value),
    []
  )
  const compatibleTypes = useMemo(() => {
    if (!activeBlock) return []
    const baseType = isOhlcChartData(activeBlock.data) ? "lightweight/candles" : activeBlock.chartType
    return getCompatibleChartTypes(baseType, activeBlock.data.xAxisType, allowedChartTypes)
  }, [activeBlock, allowedChartTypes])
  const compatibleTypeSet = useMemo(() => new Set(compatibleTypes), [compatibleTypes])
  const chartTypeOptionsForControl = useMemo(() => {
    if (!activeBlock) return CHART_TYPE_OPTIONS
    if (CHART_TYPE_OPTIONS.some((option) => option.value === activeBlock.chartType)) {
      return CHART_TYPE_OPTIONS
    }
    // 현재 타입이 공용 옵션 밖에 있으면 선택값 유지를 위해 임시 항목을 선두에 노출한다.
    return [
      {
        value: activeBlock.chartType,
        label: activeBlock.chartType,
        iconKey: inferChartTypeIconKey(activeBlock.chartType),
      },
      ...CHART_TYPE_OPTIONS,
    ]
  }, [activeBlock])
  const activeChartTypeOption = useMemo(() => {
    if (!activeBlock) return null
    return (
      chartTypeOptionsForControl.find((option) => option.value === activeBlock.chartType) ??
      {
        value: activeBlock.chartType,
        label: activeBlock.chartType,
        iconKey: inferChartTypeIconKey(activeBlock.chartType),
      }
    )
  }, [activeBlock, chartTypeOptionsForControl])

  const recalculateChartTypeSelectHeight = useCallback(() => {
    if (!chartTypeSelectOpen) return

    const triggerElement = chartTypeSelectContainerRef.current?.querySelector<HTMLElement>("[data-slot='select-trigger']")
    if (!triggerElement) return

    const dropdownGap = 10
    const triggerRect = triggerElement.getBoundingClientRect()
    const viewportBottom = window.innerHeight - 12
    const viewportAvailableHeight = viewportBottom - triggerRect.bottom - dropdownGap
    let nextMaxHeight = viewportAvailableHeight

    if (sideTab === "data" && derivedSectionElement) {
      const derivedRect = derivedSectionElement.getBoundingClientRect()
      nextMaxHeight = Math.min(nextMaxHeight, derivedRect.top - triggerRect.bottom - dropdownGap)
    }

    setChartTypeSelectMaxHeight(Math.max(0, Math.floor(nextMaxHeight)))
  }, [chartTypeSelectOpen, derivedSectionElement, sideTab])

  useEffect(() => {
    if (!chartTypeSelectOpen) {
      setChartTypeSelectMaxHeight(null)
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      recalculateChartTypeSelectHeight()
    })

    const handleLayoutChange = () => {
      window.requestAnimationFrame(() => {
        recalculateChartTypeSelectHeight()
      })
    }

    window.addEventListener("resize", handleLayoutChange)
    window.addEventListener("scroll", handleLayoutChange, true)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", handleLayoutChange)
      window.removeEventListener("scroll", handleLayoutChange, true)
    }
  }, [chartTypeSelectOpen, recalculateChartTypeSelectHeight])

  const updateBlockStyle = useCallback((blockId: string, updater: (prev: ChartStyle) => ChartStyle) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block
        return {
          ...block,
          style: updater(block.style),
        }
      })
    )
  }, [])
  const handleActiveChartTypeChange = useCallback((nextType: ChartType) => {
    if (!activeBlock || nextType === activeBlock.chartType) return
    // 타입만 교체해 업로드/결합 데이터와 스타일 상태를 그대로 유지한다.
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== activeBlock.id) return block
        return {
          ...block,
          chartType: nextType,
        }
      })
    )
    setChartTypeSelectOpen(false)
  }, [activeBlock])
  const handleLegendStateChange = useCallback((state: { tooltipPayload: any[] | null; hoveredLabel: string | null; treemapStats?: any }) => {
    // 차트별 hover/tooltip 상태를 저장해 패널2 legend 값과 동기화한다.
    setLegendStateByChartId((prev) => {
      const current = prev[activeChartId]
      const nextLegendState = {
        tooltipPayload: state.tooltipPayload ?? null,
        hoveredLabel: state.hoveredLabel ?? null,
        treemapStats: state.treemapStats ?? null,
      }
      const prevSignature = getLegendStateSignature({
        tooltipPayload: current?.tooltipPayload ?? null,
        hoveredLabel: current?.hoveredLabel ?? null,
        treemapStats: current?.treemapStats ?? null,
      })
      const nextSignature = getLegendStateSignature(nextLegendState)
      if (prevSignature === nextSignature) return prev
      return {
        ...prev,
        [activeChartId]: {
          ...nextLegendState,
          chartCoreLegendMeta: current?.chartCoreLegendMeta ?? null,
        },
      }
    })
  }, [activeChartId])
  const handleChartCoreLegendMetaChange = useCallback((meta: ChartCoreLegendMeta | null) => {
    setLegendStateByChartId((prev) => {
      const current = prev[activeChartId]
      const prevSignature = getChartCoreLegendMetaSignature(current?.chartCoreLegendMeta ?? null)
      const nextSignature = getChartCoreLegendMetaSignature(meta)
      if (prevSignature === nextSignature) return prev
      return {
        ...prev,
        [activeChartId]: {
          tooltipPayload: current?.tooltipPayload ?? null,
          hoveredLabel: current?.hoveredLabel ?? null,
          treemapStats: current?.treemapStats ?? null,
          chartCoreLegendMeta: meta,
        },
      }
    })
  }, [activeChartId])
  const handleChartCoreLegendHostRef = useCallback((node: HTMLElement | null) => {
    // ref 콜백이 반복 호출되어도 동일 노드면 상태를 유지해 불필요한 렌더를 줄인다.
    setChartCoreLegendContainer((prev) => (prev === node ? prev : node))
  }, [])
  const hierarchySelectedCompany = useMemo(
    () => hierarchyCompanies.find((company) => company.id === hierarchyState.companyId) ?? null,
    [hierarchyCompanies, hierarchyState.companyId]
  )
  const hierarchySourceNodes = useMemo(
    () => buildHierarchySourceNodes(hierarchyMetrics, hierarchyState.metricSearchTerm),
    [hierarchyMetrics, hierarchyState.metricSearchTerm]
  )
  const hierarchySelectedMetrics = useMemo<HierarchySelectedMetric[]>(() => {
    return hierarchyState.selectedMetricKeys
      .flatMap((metricKey) => {
        const metric = hierarchyMetrics.find((item) => item.metricKey === metricKey)
        if (!metric) return []
        return [{
          metricKey: metric.metricKey,
          label: metric.label,
          unit: metric.unit,
          entitySource: metric.entitySource,
        }]
      })
  }, [hierarchyMetrics, hierarchyState.selectedMetricKeys])
  const derivedFormulaPreset = useMemo(
    () => getDerivedFormulaPreset(derivedState.formulaId),
    [derivedState.formulaId]
  )
  const derivedMetricOptions = useMemo(
    () => hierarchyMetrics.map((metric) => ({
      metricKey: metric.metricKey,
      label: metric.label,
    })),
    [hierarchyMetrics]
  )

  const loadHierarchyMetricsForCompany = useCallback(async (companyId: string) => {
    if (!companyId) {
      setHierarchyMetrics([])
      clearHierarchyMetricSelections()
      pruneDerivedUnavailableMetrics([])
      return
    }

    setIsHierarchyMetricsLoading(true)
    setHierarchyError(null)
    setDerivedError(null)
    const { items, error } = USE_MOCK_SECTORBOOK_PROVIDER
      ? await fetchMockSectorbookMetricCatalog({ companyId })
      : await fetchCompanyMetricCatalog(supabase, { companyId })
    setIsHierarchyMetricsLoading(false)

    if (error) {
      setHierarchyMetrics([])
      clearHierarchyMetricSelections()
      pruneDerivedUnavailableMetrics([])
      setHierarchyError(`metric 목록 조회 실패: ${error}`)
      return
    }

    const catalogItems = mapCatalogItems(items)
    setHierarchyMetrics(catalogItems)
    pruneHierarchyUnavailableMetrics(catalogItems.map((item) => item.metricKey))
    pruneDerivedUnavailableMetrics(catalogItems.map((item) => item.metricKey))
    if (catalogItems.length === 0) {
      setHierarchyError("선택한 기업에 조회 가능한 metric 데이터가 없습니다.")
    }
  }, [clearHierarchyMetricSelections, pruneDerivedUnavailableMetrics, pruneHierarchyUnavailableMetrics, supabase])

  const loadHierarchyCompanies = useCallback(async (searchKeyword: string) => {
    setIsHierarchyCompaniesLoading(true)
    setHierarchyError(null)
    setDerivedError(null)
    try {
      const keyword = searchKeyword.trim()
      let nextCompanies: PageHDbCompanyOption[] = []

      if (USE_MOCK_SECTORBOOK_PROVIDER) {
        const { items, error } = await fetchMockSectorbookCompanies({
          searchKeyword: keyword,
          limit: 30,
        })
        if (error) {
          setHierarchyCompanies([])
          setHierarchyError(`기업 목록 조회 실패: ${error}`)
          return
        }
        nextCompanies = items.map((item) => ({
          id: item.id,
          name: item.name,
          ticker: item.ticker,
          market: item.market,
        }))
      } else {
        let query = supabase
          .from("entity_item")
          .select("id, name, data, type:entity_type!inner(name)")
          .eq("type.name", "company")
          .eq("metadata->>is_active", "true")
          .order("name")
          .limit(30)

        if (keyword.length > 0) {
          query = query.ilike("name", `%${keyword}%`)
        }

        const { data, error } = await query
        if (error) {
          setHierarchyCompanies([])
          setHierarchyError(`기업 목록 조회 실패: ${error.message}`)
          return
        }

        nextCompanies = (data ?? []).map((item) => {
          const metadata = (item.data as Record<string, unknown> | null) ?? null
          return {
            id: item.id,
            name: item.name,
            ticker: typeof metadata?.ticker === "string" ? metadata.ticker : undefined,
            market: typeof metadata?.market === "string" ? metadata.market : undefined,
          }
        })
      }

      setHierarchyCompanies(nextCompanies)
      const fallbackCompanyId = nextCompanies[0]?.id ?? ""
      const nextCompanyId = nextCompanies.some((company) => company.id === hierarchyState.companyId)
        ? hierarchyState.companyId
        : fallbackCompanyId
      setHierarchyCompanyId(nextCompanyId)
      if (!nextCompanyId) {
        setHierarchyMetrics([])
        clearHierarchyMetricSelections()
        resetDerivedState()
      }
    } finally {
      setIsHierarchyCompaniesLoading(false)
    }
  }, [clearHierarchyMetricSelections, hierarchyState.companyId, resetDerivedState, setHierarchyCompanyId, supabase])

  const handleHierarchyCompanySearch = useCallback(() => {
    void loadHierarchyCompanies(hierarchyState.companySearchTerm)
  }, [hierarchyState.companySearchTerm, loadHierarchyCompanies])

  const handleApplyHierarchyMetrics = useCallback(async () => {
    if (!hierarchyState.companyId) {
      setHierarchyError("회사를 먼저 선택해 주세요.")
      return
    }
    if (hierarchyState.selectedMetricKeys.length === 0) {
      setHierarchyError("차트에 반영할 metric을 선택해 주세요.")
      return
    }

    const selectedMetrics = hierarchyState.selectedMetricKeys
      .map((metricKey) => hierarchyMetrics.find((item) => item.metricKey === metricKey) ?? null)
      .filter((metric): metric is DbMetricCatalogItem => metric !== null)

    if (selectedMetrics.length === 0) {
      setHierarchyError("선택한 metric 정보를 찾을 수 없습니다. metric을 다시 선택해 주세요.")
      return
    }

    setIsHierarchyApplyLoading(true)
    setHierarchyError(null)
    setDerivedError(null)

    try {
      const metricResults = await Promise.all(
        selectedMetrics.map(async (metric) => {
          const response = USE_MOCK_SECTORBOOK_PROVIDER
            ? await fetchMockSectorbookMetricRows({
              companyId: hierarchyState.companyId,
              metricTypeId: metric.metricTypeId,
              entitySource: metric.entitySource,
              dimension: hierarchyState.dimensionKey,
            })
            : await fetchCompanyMetricRows(supabase, {
              companyId: hierarchyState.companyId,
              metricTypeId: metric.metricTypeId,
              entitySource: metric.entitySource,
              dimension: hierarchyState.dimensionKey,
            })

          if (response.error) {
            throw new Error(`${metric.label}: ${response.error}`)
          }

          return {
            metric,
            rows: response.rows,
            companyName: response.companyName,
          }
        })
      )

      const chartData = buildChartDataFromHierarchySeries(
        metricResults
          .filter((result) => result.rows.length > 0)
          .map((result) => ({
            metricKey: result.metric.metricKey,
            seriesName: `${result.companyName ?? hierarchySelectedCompany?.name ?? "선택 기업"} ${result.metric.label}`,
            unit: result.metric.unit,
            rows: result.rows,
          }))
      )

      if (!chartData || chartData.series.length === 0) {
        setHierarchyError("선택한 metric의 시계열 데이터가 없어 차트를 생성할 수 없습니다.")
        return
      }

      const companyLabel = metricResults[0]?.companyName ?? hierarchySelectedCompany?.name ?? "선택 기업"
      const targetChartType = activeBlock?.chartType ?? "chartCore/line"
      const nextTitle = `${companyLabel} 지표 비교`
      const nextDescription = `${resolveCoreType(targetChartType)} · 계층 선택 · ${chartData.series.length}개 시리즈`

      if (!activeBlock) {
        const newBlockId = `blend-${Date.now()}`
        setBlocks((prev) => [
          ...prev,
          {
            id: newBlockId,
            title: nextTitle,
            description: nextDescription,
            chartType: targetChartType,
            data: chartData,
            style: {
              legend: { position: "none" },
              tooltip: { shared: true },
              colorPalette: BASE_PALETTE,
              chartCore: { showOutliers: true },
              timepointLine: { showOutliers: true },
            },
          },
        ])
        setActiveChartId(newBlockId)
      } else {
        setBlocks((prev) =>
          prev.map((block) => {
            if (block.id !== activeBlock.id) return block
            return {
              ...block,
              title: nextTitle,
              description: nextDescription,
              data: chartData,
            }
          })
        )
      }

      setJoinPreview(null)
      setBlendMessage(`${companyLabel} 기준 ${chartData.series.length}개 지표를 차트에 반영했습니다.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "계층 metric 반영 중 오류가 발생했습니다."
      setHierarchyError(message)
    } finally {
      setIsHierarchyApplyLoading(false)
    }
  }, [
    activeBlock,
    hierarchyMetrics,
    hierarchySelectedCompany?.name,
    hierarchyState.companyId,
    hierarchyState.dimensionKey,
    hierarchyState.selectedMetricKeys,
    supabase,
  ])

  const handleDerivedFormulaChange = useCallback((formulaId: DerivedFormulaId) => {
    setDerivedFormulaId(formulaId)
    const preset = getDerivedFormulaPreset(formulaId)
    if (preset.inputCount === 1) {
      setDerivedSecondaryMetricKey("")
    }
  }, [setDerivedFormulaId, setDerivedSecondaryMetricKey])

  const handleApplyDerivedMetric = useCallback(async () => {
    if (!hierarchyState.companyId) {
      setDerivedError("회사를 먼저 선택해 주세요.")
      return
    }

    if (!derivedState.primaryMetricKey) {
      setDerivedError("원본 지표 A를 선택해 주세요.")
      return
    }

    const preset = getDerivedFormulaPreset(derivedState.formulaId)
    if (preset.inputCount === 2 && !derivedState.secondaryMetricKey) {
      setDerivedError("원본 지표 B를 선택해 주세요.")
      return
    }

    if (preset.inputCount === 2 && derivedState.primaryMetricKey === derivedState.secondaryMetricKey) {
      setDerivedError("원본 지표 A/B는 서로 다른 지표를 선택해 주세요.")
      return
    }

    const primaryMetric = hierarchyMetrics.find((metric) => metric.metricKey === derivedState.primaryMetricKey) ?? null
    if (!primaryMetric) {
      setDerivedError("선택한 원본 지표 A 정보를 찾을 수 없습니다.")
      return
    }

    const secondaryMetric = preset.inputCount === 2
      ? hierarchyMetrics.find((metric) => metric.metricKey === derivedState.secondaryMetricKey) ?? null
      : null

    if (preset.inputCount === 2 && !secondaryMetric) {
      setDerivedError("선택한 원본 지표 B 정보를 찾을 수 없습니다.")
      return
    }

    setDerivedError(null)
    setHierarchyError(null)

    try {
      const metricTargets = preset.inputCount === 2 && secondaryMetric
        ? [primaryMetric, secondaryMetric]
        : [primaryMetric]

      const metricRows = await Promise.all(
        metricTargets.map(async (metric) => {
          const response = USE_MOCK_SECTORBOOK_PROVIDER
            ? await fetchMockSectorbookMetricRows({
              companyId: hierarchyState.companyId,
              metricTypeId: metric.metricTypeId,
              entitySource: metric.entitySource,
              dimension: hierarchyState.dimensionKey,
            })
            : await fetchCompanyMetricRows(supabase, {
              companyId: hierarchyState.companyId,
              metricTypeId: metric.metricTypeId,
              entitySource: metric.entitySource,
              dimension: hierarchyState.dimensionKey,
            })

          if (response.error) {
            throw new Error(`${metric.label}: ${response.error}`)
          }

          return {
            metric,
            rows: response.rows,
            companyName: response.companyName,
          }
        })
      )

      const primaryResult = metricRows.find((row) => row.metric.metricKey === primaryMetric.metricKey)
      const secondaryResult = secondaryMetric
        ? metricRows.find((row) => row.metric.metricKey === secondaryMetric.metricKey)
        : null

      if (!primaryResult || (preset.inputCount === 2 && !secondaryResult)) {
        throw new Error("파생 지표 계산용 원본 시계열 데이터를 찾지 못했습니다.")
      }

      const derivedSeries = computeDerivedMetricSeries({
        formulaId: derivedState.formulaId,
        primaryMetric: {
          metricKey: primaryResult.metric.metricKey,
          label: primaryResult.metric.label,
          unit: primaryResult.metric.unit,
          rows: primaryResult.rows,
        },
        secondaryMetric: secondaryResult
          ? {
            metricKey: secondaryResult.metric.metricKey,
            label: secondaryResult.metric.label,
            unit: secondaryResult.metric.unit,
            rows: secondaryResult.rows,
          }
          : null,
        customName: derivedState.customName,
      })

      if (derivedSeries.rows.length === 0) {
        setDerivedError("계산 가능한 시점이 없어 파생 지표를 생성하지 못했습니다.")
        return
      }

      const derivedChartData = buildChartDataFromHierarchySeries([
        {
          metricKey: derivedSeries.metricKey,
          seriesName: derivedSeries.seriesName,
          unit: derivedSeries.unit,
          rows: derivedSeries.rows,
        },
      ])

      if (!derivedChartData || derivedChartData.series.length === 0) {
        setDerivedError("파생 지표 데이터가 비어 있어 차트를 생성할 수 없습니다.")
        return
      }

      const companyLabel = metricRows[0]?.companyName ?? hierarchySelectedCompany?.name ?? "선택 기업"
      const targetChartType = activeBlock?.chartType ?? "chartCore/line"
      const nextTitle = `${companyLabel} 파생 지표`
      const nextDescription = `${resolveCoreType(targetChartType)} · 파생 지표 · ${derivedSeries.seriesName}`

      const mergedChartData =
        activeBlock &&
          activeBlock.data.xAxisType === "category" &&
          !isOhlcChartData(activeBlock.data)
          ? {
            xAxisType: "category" as const,
            series: [
              ...activeBlock.data.series.filter((series) => series.id !== derivedSeries.metricKey),
              ...derivedChartData.series,
            ],
          }
          : derivedChartData

      if (!activeBlock) {
        const newBlockId = `blend-${Date.now()}`
        setBlocks((prev) => [
          ...prev,
          {
            id: newBlockId,
            title: nextTitle,
            description: nextDescription,
            chartType: targetChartType,
            data: mergedChartData,
            style: {
              legend: { position: "none" },
              tooltip: { shared: true },
              colorPalette: BASE_PALETTE,
              chartCore: { showOutliers: true },
              timepointLine: { showOutliers: true },
            },
          },
        ])
        setActiveChartId(newBlockId)
      } else {
        setBlocks((prev) =>
          prev.map((block) => {
            if (block.id !== activeBlock.id) return block
            return {
              ...block,
              title: nextTitle,
              description: nextDescription,
              data: mergedChartData,
            }
          })
        )
      }

      setJoinPreview(null)
      setBlendMessage(formatDerivedBlendMessage(derivedSeries.seriesName, derivedSeries.rows.length))
    } catch (error) {
      const message = error instanceof Error ? error.message : "파생 지표 계산 중 오류가 발생했습니다."
      setDerivedError(message)
    } finally {
    }
  }, [
    activeBlock,
    derivedState.customName,
    derivedState.formulaId,
    derivedState.primaryMetricKey,
    derivedState.secondaryMetricKey,
    hierarchyMetrics,
    hierarchySelectedCompany?.name,
    hierarchyState.companyId,
    hierarchyState.dimensionKey,
    supabase,
  ])

  // 파생지표 자동 적용
  useEffect(() => {
    const preset = getDerivedFormulaPreset(derivedState.formulaId)
    if (!derivedState.primaryMetricKey) return

    if (preset.inputCount === 2 && !derivedState.secondaryMetricKey) return

    const timer = setTimeout(() => {
      handleApplyDerivedMetric()
    }, 300)
    return () => clearTimeout(timer)
  }, [
    derivedState.formulaId,
    derivedState.primaryMetricKey,
    derivedState.secondaryMetricKey,
    derivedState.customName,
    handleApplyDerivedMetric,
  ])

  useEffect(() => {
    void loadHierarchyCompanies("")
  }, [loadHierarchyCompanies])

  useEffect(() => {
    if (!hierarchyState.companyId) return
    void loadHierarchyMetricsForCompany(hierarchyState.companyId)
  }, [hierarchyState.companyId, loadHierarchyMetricsForCompany])

  const activeDbSelection = dbSelectionBySlot[dbTargetSlot]
  const activeDbMetrics = useMemo(
    () => dbMetricCatalogBySlot[dbTargetSlot] ?? [],
    [dbMetricCatalogBySlot, dbTargetSlot]
  )
  const activeDbMetric = useMemo(
    () => activeDbMetrics.find((metric) => metric.metricKey === activeDbSelection.metricKey) ?? null,
    [activeDbMetrics, activeDbSelection.metricKey]
  )
  const availableDbMetricOptions = useMemo<PageHDbOption[]>(
    () => activeDbMetrics.map((metric) => ({ value: metric.metricKey, label: metric.label })),
    [activeDbMetrics]
  )
  const canFetchDbPreview = activeDbSelection.queryMode === "ohlcv"
    ? true
    : Boolean(activeDbSelection.metricKey)
  const availableDbDimensionOptions = useMemo<PageHDbOption[]>(() => {
    if (activeDbSelection.queryMode === "ohlcv") {
      return [{ value: "daily", label: "일간" }]
    }
    if (!activeDbMetric || activeDbMetric.dimensions.length === 0) {
      return [DB_AUTO_DIMENSION_OPTION]
    }
    const dimensionSet = new Set(activeDbMetric.dimensions)
    const options = DB_DIMENSION_OPTIONS.filter((option) => dimensionSet.has(option.value as MetricDimension))
    return options.length > 0 ? options : [DB_AUTO_DIMENSION_OPTION]
  }, [activeDbMetric, activeDbSelection.queryMode])
  const selectedDbCompany = useMemo(
    () => dbCompanies.find((company) => company.id === activeDbSelection.companyId) ?? null,
    [activeDbSelection.companyId, dbCompanies]
  )
  const activeDbPreview = dbPreviewBySlot[dbTargetSlot] ?? null

  const clearDbPreviewForSlot = useCallback((slot: UploadSlotId) => {
    // 선택값이 바뀐 슬롯만 미리보기를 제거해 오래된 결과 오인을 막는다.
    setDbPreviewBySlot((prev) => {
      if (!prev[slot]) return prev
      const next = { ...prev }
      delete next[slot]
      return next
    })
  }, [])

  const clearDbMetricCatalogForSlot = useCallback((slot: UploadSlotId) => {
    setDbMetricCatalogBySlot((prev) => {
      if (!(slot in prev)) return prev
      const next = { ...prev }
      delete next[slot]
      return next
    })
  }, [])

  const patchDbSelection = useCallback((slot: UploadSlotId, patch: Partial<DbSlotSelection>) => {
    setDbSelectionBySlot((prev) => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        ...patch,
      },
    }))
  }, [])

  const loadDbMetricsForSlot = useCallback(async (slot: UploadSlotId, companyId: string) => {
    if (!companyId) {
      setDbSelectionBySlot((prev) => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          metricKey: "",
          dimensionKey: prev[slot].queryMode === "ohlcv" ? "daily" : "auto",
        },
      }))
      clearDbMetricCatalogForSlot(slot)
      return
    }

    setDbMetricCatalogBySlot((prev) => ({
      ...prev,
      [slot]: [],
    }))
    setIsDbMetricsLoading(true)
    const { items, error } = USE_MOCK_SECTORBOOK_PROVIDER
      ? await fetchMockSectorbookMetricCatalog({ companyId })
      : await fetchCompanyMetricCatalog(supabase, { companyId })
    setIsDbMetricsLoading(false)

    if (error) {
      setDbMetricCatalogBySlot((prev) => ({
        ...prev,
        [slot]: [],
      }))
      clearDbPreviewForSlot(slot)
      setDbError(`metric 목록 조회 실패: ${error}`)
      return
    }

    const catalogItems = mapCatalogItems(items)
    setDbMetricCatalogBySlot((prev) => ({
      ...prev,
      [slot]: catalogItems,
    }))
    setDbSelectionBySlot((prev) => {
      const currentSelection = prev[slot]
      if (currentSelection.companyId !== companyId) {
        // 빠르게 기업을 바꾼 경우 오래된 응답으로 선택 상태를 덮어쓰지 않는다.
        return prev
      }
      const selectedMetric =
        catalogItems.find((item) => item.metricKey === currentSelection.metricKey) ??
        catalogItems[0] ??
        null
      const nextMetricKey = selectedMetric?.metricKey ?? ""
      const nextDimensionKey = currentSelection.queryMode === "ohlcv"
        ? "daily"
        : resolveDimensionForMetric(selectedMetric, currentSelection.dimensionKey)
      return {
        ...prev,
        [slot]: {
          ...currentSelection,
          metricKey: nextMetricKey,
          dimensionKey: nextDimensionKey,
        },
      }
    })

    if (catalogItems.length === 0) {
      clearDbPreviewForSlot(slot)
      setDbError("선택한 기업에 조회 가능한 metric 데이터가 없습니다.")
    }
  }, [clearDbMetricCatalogForSlot, clearDbPreviewForSlot, supabase])

  const loadDbCompanies = useCallback(async (searchKeyword: string) => {
    setIsDbCompaniesLoading(true)
    setDbError(null)
    try {
      const keyword = searchKeyword.trim()
      let nextCompanies: PageHDbCompanyOption[] = []

      if (USE_MOCK_SECTORBOOK_PROVIDER) {
        const { items, error } = await fetchMockSectorbookCompanies({
          searchKeyword: keyword,
          limit: 30,
        })
        if (error) {
          setDbCompanies([])
          setDbError(`기업 목록 조회 실패: ${error}`)
          return
        }

        nextCompanies = items.map((item) => ({
          id: item.id,
          name: item.name,
          ticker: item.ticker,
          market: item.market,
        }))
      } else {
        let query = supabase
          .from("entity_item")
          .select("id, name, data, type:entity_type!inner(name)")
          .eq("type.name", "company")
          .eq("metadata->>is_active", "true")
          .order("name")
          .limit(30)

        if (keyword.length > 0) {
          query = query.ilike("name", `%${keyword}%`)
        }

        const { data, error } = await query
        if (error) {
          setDbCompanies([])
          setDbError(`기업 목록 조회 실패: ${error.message}`)
          return
        }

        nextCompanies = (data ?? []).map((item) => {
          const metadata = (item.data as Record<string, unknown> | null) ?? null
          return {
            id: item.id,
            name: item.name,
            ticker: typeof metadata?.ticker === "string" ? metadata.ticker : undefined,
            market: typeof metadata?.market === "string" ? metadata.market : undefined,
          }
        })
      }

      setDbCompanies(nextCompanies)
      let didChangeACompany = false
      let didChangeBCompany = false
      setDbSelectionBySlot((prev) => {
        const fallbackCompanyId = nextCompanies[0]?.id ?? ""
        const resolveCompanyId = (currentCompanyId: string): string => {
          if (nextCompanies.length === 0) return ""
          if (nextCompanies.some((company) => company.id === currentCompanyId)) return currentCompanyId
          return fallbackCompanyId
        }
        const nextCompanyIdA = resolveCompanyId(prev.A.companyId)
        const nextCompanyIdB = resolveCompanyId(prev.B.companyId)
        didChangeACompany = nextCompanyIdA !== prev.A.companyId
        didChangeBCompany = nextCompanyIdB !== prev.B.companyId
        return {
          A: {
            ...prev.A,
            companyId: nextCompanyIdA,
            metricKey: didChangeACompany ? "" : prev.A.metricKey,
            dimensionKey: didChangeACompany ? (prev.A.queryMode === "ohlcv" ? "daily" : "auto") : prev.A.dimensionKey,
          },
          B: {
            ...prev.B,
            companyId: nextCompanyIdB,
            metricKey: didChangeBCompany ? "" : prev.B.metricKey,
            dimensionKey: didChangeBCompany ? (prev.B.queryMode === "ohlcv" ? "daily" : "auto") : prev.B.dimensionKey,
          },
        }
      })
      if (didChangeACompany) {
        clearDbMetricCatalogForSlot("A")
        clearDbPreviewForSlot("A")
      }
      if (didChangeBCompany) {
        clearDbMetricCatalogForSlot("B")
        clearDbPreviewForSlot("B")
      }
    } finally {
      setIsDbCompaniesLoading(false)
    }
  }, [clearDbMetricCatalogForSlot, clearDbPreviewForSlot, supabase])

  const handleDbCompanySelect = useCallback((companyId: string) => {
    const nextDimensionKey: PageHDbDimensionKey = activeDbSelection.queryMode === "ohlcv" ? "daily" : "auto"
    patchDbSelection(dbTargetSlot, { companyId, metricKey: "", dimensionKey: nextDimensionKey })
    clearDbMetricCatalogForSlot(dbTargetSlot)
    clearDbPreviewForSlot(dbTargetSlot)
    setDbError(null)
    if (activeDbSelection.queryMode === "metric") {
      void loadDbMetricsForSlot(dbTargetSlot, companyId)
    }
  }, [activeDbSelection.queryMode, clearDbMetricCatalogForSlot, clearDbPreviewForSlot, dbTargetSlot, loadDbMetricsForSlot, patchDbSelection])

  const handleDbQueryModeChange = useCallback((mode: PageHDbQueryMode) => {
    if (mode === "ohlcv") {
      patchDbSelection(dbTargetSlot, {
        queryMode: mode,
        dimensionKey: "daily",
      })
      clearDbPreviewForSlot(dbTargetSlot)
      setDbError(null)
      return
    }

    const nextMetric =
      activeDbMetric ??
      activeDbMetrics[0] ??
      null
    patchDbSelection(dbTargetSlot, {
      queryMode: mode,
      metricKey: nextMetric?.metricKey ?? activeDbSelection.metricKey,
      dimensionKey: resolveDimensionForMetric(nextMetric, activeDbSelection.dimensionKey),
    })
    clearDbPreviewForSlot(dbTargetSlot)
    setDbError(null)
    if (activeDbSelection.companyId && activeDbMetrics.length === 0) {
      void loadDbMetricsForSlot(dbTargetSlot, activeDbSelection.companyId)
    }
  }, [
    activeDbMetric,
    activeDbMetrics,
    activeDbSelection.companyId,
    activeDbSelection.dimensionKey,
    activeDbSelection.metricKey,
    clearDbPreviewForSlot,
    dbTargetSlot,
    loadDbMetricsForSlot,
    patchDbSelection,
  ])

  const handleDbMetricChange = useCallback((metricKey: PageHDbMetricKey) => {
    const selectedMetric =
      activeDbMetrics.find((item) => item.metricKey === metricKey) ??
      null
    patchDbSelection(dbTargetSlot, {
      metricKey,
      dimensionKey: resolveDimensionForMetric(selectedMetric, activeDbSelection.dimensionKey),
    })
    clearDbPreviewForSlot(dbTargetSlot)
    setDbError(null)
  }, [activeDbMetrics, activeDbSelection.dimensionKey, clearDbPreviewForSlot, dbTargetSlot, patchDbSelection])

  const handleDbDimensionChange = useCallback((dimensionKey: PageHDbDimensionKey) => {
    patchDbSelection(dbTargetSlot, { dimensionKey })
    clearDbPreviewForSlot(dbTargetSlot)
    setDbError(null)
  }, [clearDbPreviewForSlot, dbTargetSlot, patchDbSelection])

  const handleDbDateRangeChange = useCallback((next: { start: string; end: string }) => {
    setDbDateRange(next)
    setDbPreviewBySlot({})
    setDbError(null)
  }, [])

  const handleDbCompanySearch = useCallback(() => {
    void loadDbCompanies(dbSearchTerm)
  }, [dbSearchTerm, loadDbCompanies])

  const handleDbPreviewFetch = useCallback(async () => {
    if (!activeDbSelection.companyId) {
      setDbError("조회할 기업을 선택해 주세요.")
      return
    }
    if (!dbDateRange.start || !dbDateRange.end) {
      setDbError("조회 기간을 입력해 주세요.")
      return
    }
    if (dbDateRange.start > dbDateRange.end) {
      setDbError("조회 시작일은 종료일보다 빠르거나 같아야 합니다.")
      return
    }
    if (activeDbSelection.queryMode === "metric" && !activeDbSelection.metricKey) {
      setDbError("조회할 metric을 선택해 주세요.")
      return
    }

    setIsDbPreviewLoading(true)
    setDbError(null)

    if (activeDbSelection.queryMode === "ohlcv") {
      const { rows, companyName, error } = USE_MOCK_SECTORBOOK_PROVIDER
        ? await fetchMockSectorbookOhlcvRows({
          companyId: activeDbSelection.companyId,
          startDate: dbDateRange.start,
          endDate: dbDateRange.end,
        })
        : await fetchCompanyOhlcvRows(supabase, {
          companyId: activeDbSelection.companyId,
          startDate: dbDateRange.start,
          endDate: dbDateRange.end,
        })
      setIsDbPreviewLoading(false)
      if (error) {
        clearDbPreviewForSlot(dbTargetSlot)
        setDbError(error)
        return
      }

      const previewRows = mapOhlcvRowsToPreviewRows(rows)
      setDbPreviewBySlot((prev) => ({
        ...prev,
        [dbTargetSlot]: {
          columns: DB_OHLCV_COLUMNS,
          rows: previewRows,
          companyName: companyName ?? selectedDbCompany?.name ?? "",
        },
      }))
      if (previewRows.length === 0) {
        setDbError("조회된 주가(OHLCV) 데이터가 없습니다.")
      }
      return
    }

    const selectedMetric = activeDbMetric
    if (!selectedMetric) {
      setIsDbPreviewLoading(false)
      clearDbPreviewForSlot(dbTargetSlot)
      setDbError("선택한 metric 정보를 찾을 수 없습니다. metric을 다시 선택해 주세요.")
      return
    }

    const { rows, companyName, metricName, error } = USE_MOCK_SECTORBOOK_PROVIDER
      ? await fetchMockSectorbookMetricRows({
        companyId: activeDbSelection.companyId,
        metricTypeId: selectedMetric.metricTypeId,
        entitySource: selectedMetric.entitySource,
        dimension: activeDbSelection.dimensionKey,
        startDate: dbDateRange.start,
        endDate: dbDateRange.end,
      })
      : await fetchCompanyMetricRows(supabase, {
        companyId: activeDbSelection.companyId,
        metricTypeId: selectedMetric.metricTypeId,
        entitySource: selectedMetric.entitySource,
        dimension: activeDbSelection.dimensionKey,
        startDate: dbDateRange.start,
        endDate: dbDateRange.end,
      })
    setIsDbPreviewLoading(false)
    if (error) {
      clearDbPreviewForSlot(dbTargetSlot)
      setDbError(error)
      return
    }

    const metricLabel = metricName ?? activeDbMetric.label ?? activeDbSelection.metricKey
    const previewRows = mapMetricRowsToPreviewRows(rows, metricLabel || "value")
    setDbPreviewBySlot((prev) => ({
      ...prev,
      [dbTargetSlot]: {
        columns: ["ts_date", metricLabel || "value"],
        rows: previewRows,
        companyName: companyName ?? selectedDbCompany?.name ?? "",
      },
    }))
    if (previewRows.length === 0) {
      setDbError("조회된 metric 데이터가 없습니다.")
    }
  }, [
    activeDbMetric,
    activeDbSelection.companyId,
    activeDbSelection.dimensionKey,
    activeDbSelection.metricKey,
    activeDbSelection.queryMode,
    clearDbPreviewForSlot,
    dbDateRange.end,
    dbDateRange.start,
    dbTargetSlot,
    selectedDbCompany?.name,
    supabase,
  ])

  const handleApplyDbRows = useCallback(() => {
    if (!activeDbPreview || activeDbPreview.rows.length === 0) {
      setDbError("슬롯에 적용할 데이터가 없습니다. 먼저 조회를 실행해 주세요.")
      return
    }
    const companyLabel = activeDbPreview.companyName || selectedDbCompany?.name || "선택 기업"
    const metricLabel = activeDbSelection.queryMode === "ohlcv"
      ? "주가(OHLCV)"
      : (activeDbMetric?.label ?? activeDbSelection.metricKey)
    const dimensionLabel =
      (activeDbSelection.dimensionKey === "auto" ? DB_AUTO_DIMENSION_OPTION.label : null) ??
      DB_DIMENSION_OPTIONS.find((option) => option.value === activeDbSelection.dimensionKey)?.label ??
      activeDbSelection.dimensionKey
    const nextSource: UploadedSource = {
      slot: dbTargetSlot,
      fileName: `DB:${companyLabel}/${metricLabel}/${dimensionLabel}`,
      fileSize: 0,
      mimeType: "application/x-supabase-query",
      columns: activeDbPreview.columns,
      rowCount: activeDbPreview.rows.length,
      rows: activeDbPreview.rows,
      uploadedAt: Date.now(),
    }
    setUploadedSources((prev) => ({
      ...prev,
      [dbTargetSlot]: nextSource,
    }))
    setDbDialogOpen(false)
    setBlendMessage(`${companyLabel} ${metricLabel}(${dimensionLabel}) 데이터를 슬롯 ${dbTargetSlot}에 불러왔습니다.`)
    setJoinPreview(null)
  }, [activeDbMetric?.label, activeDbPreview, activeDbSelection.dimensionKey, activeDbSelection.metricKey, activeDbSelection.queryMode, dbTargetSlot, selectedDbCompany?.name])

  const uploadedA = uploadedSources.A
  const uploadedB = uploadedSources.B
  const hasBothSources = Boolean(uploadedA && uploadedB)
  const hasAtLeastOneSource = Boolean(uploadedA || uploadedB)
  const hasWidePeriodBlendPair = useMemo(() => {
    if (!uploadedA || !uploadedB) return false
    return hasPeriodHeaderColumns(uploadedA.columns) && hasPeriodHeaderColumns(uploadedB.columns)
  }, [uploadedA, uploadedB])
  const isAppendMode = hasBothSources && joinType === "append"
  const singleSource = useMemo(() => {
    if (uploadedA && !uploadedB) return uploadedA
    if (uploadedB && !uploadedA) return uploadedB
    return null
  }, [uploadedA, uploadedB])
  const isSingleOhlcMode = useMemo(() => {
    if (!singleSource) return false
    return isOhlcLikeSource(singleSource.columns, singleSource.rows)
  }, [singleSource])
  const isDualOhlcOverlayMode = useMemo(() => {
    if (!uploadedA || !uploadedB) return false
    return isOhlcLikeSource(uploadedA.columns, uploadedA.rows) && isOhlcLikeSource(uploadedB.columns, uploadedB.rows)
  }, [uploadedA, uploadedB])
  const normalizedSemanticMappingA = useMemo(() => {
    if (!uploadedA) return createEmptyBlendSemanticMapping()
    return normalizeBlendSemanticMapping(uploadedA.rows, uploadedA.columns, semanticMappingBySlot.A)
  }, [semanticMappingBySlot.A, uploadedA])
  const normalizedSemanticMappingB = useMemo(() => {
    if (!uploadedB) return createEmptyBlendSemanticMapping()
    return normalizeBlendSemanticMapping(uploadedB.rows, uploadedB.columns, semanticMappingBySlot.B)
  }, [semanticMappingBySlot.B, uploadedB])
  const normalizedSourceA = useMemo(() => {
    if (!uploadedA) return null
    return normalizeSourceRowsForBlend(uploadedA.rows, uploadedA.columns, normalizedSemanticMappingA)
  }, [normalizedSemanticMappingA, uploadedA])
  const normalizedSourceB = useMemo(() => {
    if (!uploadedB) return null
    return normalizeSourceRowsForBlend(uploadedB.rows, uploadedB.columns, normalizedSemanticMappingB)
  }, [normalizedSemanticMappingB, uploadedB])
  const appendedSourcesForAxis = useMemo(() => {
    if (!uploadedA || !uploadedB) return null
    return appendRows(uploadedA.rows, uploadedB.rows, uploadedA.columns, uploadedB.columns)
  }, [uploadedA, uploadedB])
  const appendColumns = useMemo(
    () => appendedSourcesForAxis?.columns ?? [],
    [appendedSourcesForAxis]
  )
  const appendedRowsForAxis = useMemo(
    () => appendedSourcesForAxis?.rows ?? [],
    [appendedSourcesForAxis]
  )
  const appendXAxisOptions = useMemo(() => {
    if (appendColumns.length === 0) return []
    return withHeaderRowXAxisOption(appendColumns)
  }, [appendColumns])
  const appendResolvedXKey = useMemo(() => {
    if (appendXAxisOptions.length === 0) return ""
    if (appendAxisSelection.xKey && appendXAxisOptions.includes(appendAxisSelection.xKey)) {
      return appendAxisSelection.xKey
    }
    return resolveDefaultXKey(appendColumns, appendedRowsForAxis)
  }, [appendAxisSelection.xKey, appendColumns, appendXAxisOptions, appendedRowsForAxis])
  const appendYAxisOptions = useMemo(() => {
    if (appendColumns.length === 0) return []
    return getSelectableColumns(appendColumns, [appendResolvedXKey])
  }, [appendColumns, appendResolvedXKey])
  const appendSelectedYKeys = useMemo(
    () => appendAxisSelection.yKeys.filter((column) => appendYAxisOptions.includes(column)),
    [appendAxisSelection.yKeys, appendYAxisOptions]
  )
  const joinKeyOptions = useMemo(() => {
    if (!normalizedSourceA || !normalizedSourceB) return []
    if (normalizedSourceA.columns.length === 0 || normalizedSourceB.columns.length === 0) return []
    const bColumnSet = new Set(normalizedSourceB.columns)
    return normalizedSourceA.columns.filter((column) => bColumnSet.has(column))
  }, [normalizedSourceA, normalizedSourceB])
  const joinedRowsForAxis = useMemo(() => {
    if (!normalizedSourceA || !normalizedSourceB) return []
    if (!joinKey) return []
    if (isDualOhlcOverlayMode) return []
    return joinRows(
      normalizedSourceA.rows,
      normalizedSourceB.rows,
      normalizedSourceA.columns,
      normalizedSourceB.columns,
      joinKey,
      joinType
    )
  }, [isDualOhlcOverlayMode, joinKey, joinType, normalizedSourceA, normalizedSourceB])
  const joinColumns = useMemo(
    () => Object.keys(joinedRowsForAxis[0] ?? {}),
    [joinedRowsForAxis]
  )
  const joinXAxisOptions = useMemo(() => {
    if (joinColumns.length === 0) return []
    return withHeaderRowXAxisOption(joinColumns)
  }, [joinColumns])
  const joinResolvedXKey = useMemo(() => {
    if (joinXAxisOptions.length === 0) return ""
    if (joinAxisSelection.xKey && joinXAxisOptions.includes(joinAxisSelection.xKey)) {
      return joinAxisSelection.xKey
    }
    if (joinKey && joinXAxisOptions.includes(joinKey)) {
      return joinKey
    }
    return joinXAxisOptions[0] ?? ""
  }, [joinAxisSelection.xKey, joinKey, joinXAxisOptions])
  const joinYAxisOptions = useMemo(() => {
    if (joinColumns.length === 0) return []
    return getSelectableColumns(joinColumns, [joinResolvedXKey])
  }, [joinColumns, joinResolvedXKey])
  const singleAxisUiState = useMemo(() => {
    if (!singleSource) return null
    const slotSelection = singleAxisBySlot[singleSource.slot]
    const axisXOptions = withHeaderRowXAxisOption(singleSource.columns)
    const resolvedXKey = axisXOptions.includes(slotSelection.xKey)
      ? slotSelection.xKey
      : resolveDefaultXKey(singleSource.columns, singleSource.rows)
    const yOptions = getSelectableColumns(singleSource.columns, [resolvedXKey])
    const selectedYKeys = slotSelection.yKeys.filter((column) => yOptions.includes(column))
    return {
      slot: singleSource.slot,
      xKey: resolvedXKey,
      xOptions: axisXOptions,
      yOptions,
      selectedYKeys,
    }
  }, [singleAxisBySlot, singleSource])
  const joinSelectedYKeys = useMemo(
    () => joinAxisSelection.yKeys.filter((column) => joinYAxisOptions.includes(column)),
    [joinAxisSelection.yKeys, joinYAxisOptions]
  )
  const semanticMappingUiBySlot = useMemo(() => {
    const slotA = uploadedA
      ? {
        columns: uploadedA.columns,
        mapping: normalizedSemanticMappingA,
        mode: normalizedSourceA?.normalizationMode ?? "identity",
      }
      : null
    const slotB = uploadedB
      ? {
        columns: uploadedB.columns,
        mapping: normalizedSemanticMappingB,
        mode: normalizedSourceB?.normalizationMode ?? "identity",
      }
      : null
    return { A: slotA, B: slotB }
  }, [normalizedSemanticMappingA, normalizedSemanticMappingB, normalizedSourceA?.normalizationMode, normalizedSourceB?.normalizationMode, uploadedA, uploadedB])

  useEffect(() => {
    if (joinKeyOptions.length === 0) {
      if (joinKey) setJoinKey("")
      return
    }
    if (!joinKey || !joinKeyOptions.includes(joinKey)) {
      setJoinKey(joinKeyOptions[0]!)
    }
  }, [joinKey, joinKeyOptions])

  useEffect(() => {
    if (!hasBothSources || !hasWidePeriodBlendPair) return
    setJoinType((prev) => (prev === "left" ? "append" : prev))
  }, [hasBothSources, hasWidePeriodBlendPair])

  useEffect(() => {
    setSemanticMappingBySlot((prev) => {
      let changed = false
      const next = { ...prev }
        ; (["A", "B"] as UploadSlotId[]).forEach((slot) => {
          const source = uploadedSources[slot]
          if (!source) {
            const empty = createEmptyBlendSemanticMapping()
            const current = prev[slot]
            if (
              current.entityColumn ||
              current.timeColumn ||
              current.metricColumn ||
              current.valueColumn
            ) {
              next[slot] = empty
              changed = true
            }
            return
          }
          const normalized = normalizeBlendSemanticMapping(source.rows, source.columns, prev[slot])
          const current = prev[slot]
          if (
            normalized.entityColumn !== current.entityColumn ||
            normalized.timeColumn !== current.timeColumn ||
            normalized.metricColumn !== current.metricColumn ||
            normalized.valueColumn !== current.valueColumn
          ) {
            next[slot] = normalized
            changed = true
          }
        })
      return changed ? next : prev
    })
  }, [uploadedSources])

  useEffect(() => {
    setSingleAxisBySlot((prev) => {
      let changed = false
      const next = { ...prev }
        ; (["A", "B"] as UploadSlotId[]).forEach((slot) => {
          const source = uploadedSources[slot]
          if (!source) {
            if (prev[slot].xKey || prev[slot].yKeys.length > 0) {
              next[slot] = createEmptyUploadAxisSelection()
              changed = true
            }
            return
          }
          const normalized = normalizeSingleAxisSelection(source.rows, source.columns, prev[slot])
          if (normalized.xKey !== prev[slot].xKey || !isSameStringArray(normalized.yKeys, prev[slot].yKeys)) {
            next[slot] = normalized
            changed = true
          }
        })
      return changed ? next : prev
    })
  }, [uploadedSources])

  useEffect(() => {
    if (!isAppendMode || isDualOhlcOverlayMode) {
      setAppendAxisSelection((prev) => {
        if (!prev.xKey && prev.yKeys.length === 0) return prev
        return { xKey: "", yKeys: [] }
      })
      return
    }

    setAppendAxisSelection((prev) => {
      const resolvedXKey = prev.xKey && appendXAxisOptions.includes(prev.xKey)
        ? prev.xKey
        : resolveDefaultXKey(appendColumns, appendedRowsForAxis)
      const next = prev.yKeys.filter((column) => column !== resolvedXKey && appendYAxisOptions.includes(column))
      const fallback = resolveDefaultYKeys(appendedRowsForAxis, appendColumns, resolvedXKey)
        .filter((column) => column !== resolvedXKey && appendYAxisOptions.includes(column))
      const resolvedYKeys = next.length > 0 ? next : fallback

      if (prev.xKey === resolvedXKey && isSameStringArray(prev.yKeys, resolvedYKeys)) return prev
      return {
        xKey: resolvedXKey,
        yKeys: resolvedYKeys,
      }
    })
  }, [appendColumns, appendXAxisOptions, appendYAxisOptions, appendedRowsForAxis, isAppendMode, isDualOhlcOverlayMode])

  useEffect(() => {
    if (!hasBothSources || isDualOhlcOverlayMode || isAppendMode || !joinKey) {
      setJoinAxisSelection((prev) => {
        if (!prev.xKey && prev.yKeys.length === 0) return prev
        return { xKey: "", yKeys: [] }
      })
      return
    }

    setJoinAxisSelection((prev) => {
      const resolvedXKey = prev.xKey && joinXAxisOptions.includes(prev.xKey)
        ? prev.xKey
        : (joinKey && joinXAxisOptions.includes(joinKey) ? joinKey : (joinXAxisOptions[0] ?? ""))

      const next = prev.yKeys.filter((column) => column !== resolvedXKey && joinYAxisOptions.includes(column))
      const fallback = resolveDefaultYKeys(joinedRowsForAxis, joinColumns, resolvedXKey)
        .filter((column) => column !== resolvedXKey && joinYAxisOptions.includes(column))
      const resolvedYKeys = next.length > 0 ? next : fallback

      if (prev.xKey === resolvedXKey && isSameStringArray(prev.yKeys, resolvedYKeys)) return prev
      return {
        xKey: resolvedXKey,
        yKeys: resolvedYKeys,
      }
    })
  }, [hasBothSources, isAppendMode, isDualOhlcOverlayMode, joinColumns, joinKey, joinXAxisOptions, joinYAxisOptions, joinedRowsForAxis])

  const handleSemanticMappingFieldChange = useCallback((slot: UploadSlotId, field: BlendSemanticField, value: string) => {
    setSemanticMappingBySlot((prev) => {
      const current = prev[slot]
      if (current[field] === value) return prev
      return {
        ...prev,
        [slot]: {
          ...current,
          [field]: value,
        },
      }
    })
  }, [])

  const handleSemanticMappingReset = useCallback((slot: UploadSlotId) => {
    const source = uploadedSources[slot]
    if (!source) return
    const inferred = inferBlendSemanticMapping(source.rows, source.columns)
    setSemanticMappingBySlot((prev) => {
      const current = prev[slot]
      if (
        current.entityColumn === inferred.entityColumn &&
        current.timeColumn === inferred.timeColumn &&
        current.metricColumn === inferred.metricColumn &&
        current.valueColumn === inferred.valueColumn
      ) {
        return prev
      }
      return {
        ...prev,
        [slot]: {
          entityColumn: inferred.entityColumn,
          timeColumn: inferred.timeColumn,
          metricColumn: inferred.metricColumn,
          valueColumn: inferred.valueColumn,
        },
      }
    })
  }, [uploadedSources])

  const handleSingleAxisXChange = useCallback((slot: UploadSlotId, xKey: string) => {
    setSingleAxisBySlot((prev) => {
      const source = uploadedSources[slot]
      if (!source) return prev

      const normalized = normalizeSingleAxisSelection(source.rows, source.columns, {
        xKey,
        yKeys: prev[slot].yKeys,
      })
      if (normalized.xKey === prev[slot].xKey && isSameStringArray(normalized.yKeys, prev[slot].yKeys)) {
        return prev
      }
      return {
        ...prev,
        [slot]: normalized,
      }
    })
  }, [uploadedSources])

  const handleSingleAxisYToggle = useCallback((slot: UploadSlotId, yKey: string) => {
    setSingleAxisBySlot((prev) => {
      const current = prev[slot]
      const exists = current.yKeys.includes(yKey)
      const nextYKeys = exists
        ? current.yKeys.filter((column) => column !== yKey)
        : [...current.yKeys, yKey]
      if (isSameStringArray(current.yKeys, nextYKeys)) return prev
      return {
        ...prev,
        [slot]: {
          ...current,
          yKeys: nextYKeys,
        },
      }
    })
  }, [])

  const handleSingleAxisYSelectAll = useCallback((slot: UploadSlotId, yOptions: string[]) => {
    setSingleAxisBySlot((prev) => {
      if (isSameStringArray(prev[slot].yKeys, yOptions)) return prev
      return {
        ...prev,
        [slot]: {
          ...prev[slot],
          yKeys: yOptions,
        },
      }
    })
  }, [])

  const handleSingleAxisYClear = useCallback((slot: UploadSlotId) => {
    setSingleAxisBySlot((prev) => {
      if (prev[slot].yKeys.length === 0) return prev
      return {
        ...prev,
        [slot]: {
          ...prev[slot],
          yKeys: [],
        },
      }
    })
  }, [])

  const handleAppendAxisXChange = useCallback((xKey: string) => {
    setAppendAxisSelection((prev) => {
      const yCandidates = getSelectableColumns(appendColumns, [xKey])
      const nextYKeys = prev.yKeys.filter((column) => yCandidates.includes(column))
      const fallback = resolveDefaultYKeys(appendedRowsForAxis, appendColumns, xKey)
        .filter((column) => yCandidates.includes(column))
      const resolvedYKeys = nextYKeys.length > 0 ? nextYKeys : fallback
      if (prev.xKey === xKey && isSameStringArray(prev.yKeys, resolvedYKeys)) return prev
      return {
        xKey,
        yKeys: resolvedYKeys,
      }
    })
  }, [appendColumns, appendedRowsForAxis])

  const handleAppendAxisYToggle = useCallback((yKey: string) => {
    setAppendAxisSelection((prev) => {
      const exists = prev.yKeys.includes(yKey)
      const nextYKeys = exists
        ? prev.yKeys.filter((column) => column !== yKey)
        : [...prev.yKeys, yKey]
      if (isSameStringArray(prev.yKeys, nextYKeys)) return prev
      return { ...prev, yKeys: nextYKeys }
    })
  }, [])

  const handleAppendAxisYSelectAll = useCallback(() => {
    setAppendAxisSelection((prev) => {
      if (isSameStringArray(prev.yKeys, appendYAxisOptions)) return prev
      return { ...prev, yKeys: appendYAxisOptions }
    })
  }, [appendYAxisOptions])

  const handleAppendAxisYClear = useCallback(() => {
    setAppendAxisSelection((prev) => {
      if (prev.yKeys.length === 0) return prev
      return { ...prev, yKeys: [] }
    })
  }, [])

  const handleJoinAxisXChange = useCallback((xKey: string) => {
    setJoinAxisSelection((prev) => {
      const yCandidates = getSelectableColumns(joinColumns, [xKey])
      const nextYKeys = prev.yKeys.filter((column) => yCandidates.includes(column))
      const fallback = resolveDefaultYKeys(joinedRowsForAxis, joinColumns, xKey)
        .filter((column) => yCandidates.includes(column))
      const resolvedYKeys = nextYKeys.length > 0 ? nextYKeys : fallback
      if (prev.xKey === xKey && isSameStringArray(prev.yKeys, resolvedYKeys)) return prev
      return {
        xKey,
        yKeys: resolvedYKeys,
      }
    })
  }, [joinColumns, joinedRowsForAxis])

  const handleJoinAxisYToggle = useCallback((yKey: string) => {
    setJoinAxisSelection((prev) => {
      const exists = prev.yKeys.includes(yKey)
      const nextYKeys = exists
        ? prev.yKeys.filter((column) => column !== yKey)
        : [...prev.yKeys, yKey]
      if (isSameStringArray(prev.yKeys, nextYKeys)) return prev
      return { ...prev, yKeys: nextYKeys }
    })
  }, [])

  const handleJoinAxisYSelectAll = useCallback(() => {
    setJoinAxisSelection((prev) => {
      if (isSameStringArray(prev.yKeys, joinYAxisOptions)) return prev
      return { ...prev, yKeys: joinYAxisOptions }
    })
  }, [joinYAxisOptions])

  const handleJoinAxisYClear = useCallback(() => {
    setJoinAxisSelection((prev) => {
      if (prev.yKeys.length === 0) return prev
      return { ...prev, yKeys: [] }
    })
  }, [])

  useEffect(() => {
    // 업로드/결합 설정이 바뀌면 이전 preview를 초기화해 오해를 방지한다.
    setJoinPreview(null)
    setBlendMessage(null)
  }, [joinKey, joinType, semanticMappingBySlot.A, semanticMappingBySlot.B, uploadedA?.uploadedAt, uploadedB?.uploadedAt])

  useEffect(() => {
    if (!dbDialogOpen) return
    setDbError(null)
    setDbMetricCatalogBySlot({})
    void loadDbCompanies("")
  }, [dbDialogOpen, loadDbCompanies])

  useEffect(() => {
    if (!dbDialogOpen) return
    if (activeDbSelection.queryMode !== "metric") return
    const catalog = dbMetricCatalogBySlot[dbTargetSlot]
    if (catalog !== undefined) return
    if (!activeDbSelection.companyId) return
    void loadDbMetricsForSlot(dbTargetSlot, activeDbSelection.companyId)
  }, [activeDbSelection.companyId, activeDbSelection.queryMode, dbDialogOpen, dbMetricCatalogBySlot, dbTargetSlot, loadDbMetricsForSlot])

  const handleUploadConfirm = useCallback(async () => {
    if (!pendingUploadFile) {
      setUploadError("업로드할 파일을 선택해 주세요.")
      return
    }
    setUploadError(null)
    setIsUploading(true)
    try {
      const metadata = await extractUploadData(pendingUploadFile)
      if (metadata.rowCount == null) {
        setUploadError("지원하지 않는 파일 형식입니다. CSV/XLSX/XLS 파일을 선택해 주세요.")
        return
      }
      const nextSource: UploadedSource = {
        slot: uploadTargetSlot,
        fileName: pendingUploadFile.name,
        fileSize: pendingUploadFile.size,
        mimeType: pendingUploadFile.type,
        columns: metadata.columns,
        rowCount: metadata.rowCount,
        rows: metadata.rows,
        uploadedAt: Date.now(),
      }
      setUploadedSources((prev) => ({
        ...prev,
        [uploadTargetSlot]: nextSource,
      }))
      setUploadDialogOpen(false)
      setPendingUploadFile(null)
    } catch {
      setUploadError("파일을 읽는 중 오류가 발생했습니다.")
    } finally {
      setIsUploading(false)
    }
  }, [pendingUploadFile, uploadTargetSlot])

  const handleQuickInputSubmit = useCallback(async () => {
    const nextValue = quickInputValue.trim()
    if (!nextValue) {
      setQuickInputError("입력 값을 작성해 주세요.")
      return
    }

    let parsedIntent = parseQuickIntent(nextValue)

    setQuickInputLoading(true)
    setQuickInputError(null)
    setBlendMessage(null)

    try {
      try {
        const intentResponse = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: nextValue }),
        })

        if (intentResponse.ok) {
          const parsedByApi = (await intentResponse.json()) as QuickIntentApiResponse
          const nextLookbackYears = Number.isFinite(Number(parsedByApi.lookbackYears))
            ? Math.min(Math.max(1, Math.floor(Number(parsedByApi.lookbackYears))), QUICK_MAX_LOOKBACK_YEARS)
            : parsedIntent.lookbackYears
          const nextPeriodMode = parsedByApi.periodMode && ["auto", "yearly", "quarterly", "monthly", "daily"].includes(parsedByApi.periodMode)
            ? parsedByApi.periodMode
            : parsedIntent.periodMode
          const apiChartTypeMap: Record<string, ChartType> = { bar: "chartCore/column", line: "chartCore/line", area: "chartCore/area", pie: "chartCore/pie", column: "chartCore/column" }
          const nextChartType = parsedByApi.chartType && parsedByApi.chartType in apiChartTypeMap
            ? apiChartTypeMap[parsedByApi.chartType]
            : parsedIntent.chartType

          parsedIntent = {
            entityName: typeof parsedByApi.entityName === "string" ? parsedByApi.entityName.trim() : parsedIntent.entityName,
            metricQuery: typeof parsedByApi.metricName === "string" ? parsedByApi.metricName.trim() : parsedIntent.metricQuery,
            lookbackYears: nextLookbackYears,
            periodMode: nextPeriodMode as "auto" | MetricDimension,
            chartType: (nextChartType as ChartType | null) ?? null,
          }
        }
      } catch {
        // Genkit 호출 실패 시에는 로컬 파서 결과를 그대로 사용한다.
      }

      if (!parsedIntent.entityName) {
        setQuickInputError("기업명을 포함해 입력해 주세요. 예: 삼성증권의 지난 5년간 매출액")
        return
      }
      if (!parsedIntent.metricQuery) {
        setQuickInputError("메트릭명을 포함해 입력해 주세요. 예: 삼성증권의 지난 5년간 매출액")
        return
      }

      let resolvedCompanyName = ""
      let selectedMetric: DbMetricCatalogItem | null = null
      let selectedPeriod: MetricDimension | null = null
      let rawItems: QuickMetricItemRow[] = []

      if (USE_MOCK_SECTORBOOK_PROVIDER) {
        const companyResponse = await fetchMockSectorbookCompanies({
          searchKeyword: parsedIntent.entityName,
          limit: 10,
        })
        if (companyResponse.error) {
          throw new Error(companyResponse.error)
        }

        const exactCompany = companyResponse.items.find((item) => item.name === parsedIntent.entityName)
        let resolvedCompany = exactCompany ?? companyResponse.items[0] ?? null
        if (!resolvedCompany) {
          const fallbackResponse = await fetchMockSectorbookCompanies({ limit: 10 })
          if (fallbackResponse.error) {
            throw new Error(fallbackResponse.error)
          }
          resolvedCompany = fallbackResponse.items
            .map((company) => ({ company, score: getTextSimilarity(company.name, parsedIntent.entityName) }))
            .sort((a, b) => b.score - a.score)[0]?.company ?? null
        }

        if (!resolvedCompany?.id) {
          throw new Error(`기업을 찾을 수 없습니다: ${parsedIntent.entityName}`)
        }
        resolvedCompanyName = resolvedCompany.name

        const mockCatalogResponse = await fetchMockSectorbookMetricCatalog({
          companyId: resolvedCompany.id,
        })
        if (mockCatalogResponse.error) {
          throw new Error(mockCatalogResponse.error)
        }

        const metricCatalog = mapCatalogItems(mockCatalogResponse.items)
        if (metricCatalog.length === 0) {
          throw new Error(`${resolvedCompany.name}에서 조회 가능한 메트릭이 없습니다.`)
        }

        selectedMetric = metricCatalog
          .map((metric) => ({ metric, score: scoreQuickMetric(metric, parsedIntent.metricQuery) }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)[0]?.metric ?? null

        if (!selectedMetric) {
          throw new Error(`메트릭을 찾을 수 없습니다: ${parsedIntent.metricQuery}`)
        }
        const targetMetric = selectedMetric

        const periodCandidates: MetricDimension[] = parsedIntent.periodMode === "auto"
          ? QUICK_PERIOD_PRIORITY.filter((period) => targetMetric.dimensions.includes(period))
          : [parsedIntent.periodMode]
        if (periodCandidates.length === 0) {
          throw new Error("선택한 메트릭에 해당 주기 데이터가 없습니다.")
        }

        let latestDate: string | null = null
        for (const period of periodCandidates) {
          const mockRowsResponse = await fetchMockSectorbookMetricRows({
            companyId: resolvedCompany.id,
            metricTypeId: targetMetric.metricTypeId,
            entitySource: targetMetric.entitySource,
            dimension: period,
          })
          if (mockRowsResponse.error) {
            throw new Error(mockRowsResponse.error)
          }

          const candidateRows = (mockRowsResponse.rows ?? []) as QuickMetricItemRow[]
          if (candidateRows.length === 0) {
            continue
          }

          const candidateLatestDate = candidateRows.reduce(
            (latest, row) => (row.ts_date > latest ? row.ts_date : latest),
            ""
          )
          if (!candidateLatestDate) {
            continue
          }

          selectedPeriod = period
          latestDate = candidateLatestDate
          rawItems = candidateRows
          break
        }

        if (!selectedPeriod || !latestDate) {
          throw new Error("조회 가능한 시계열 데이터가 없습니다.")
        }

        const startDate = getQuickStartDate(latestDate, parsedIntent.lookbackYears)
        rawItems = rawItems.filter((item) => item.ts_date >= startDate && item.ts_date <= latestDate)
      } else {
        const companyBaseQuery = supabase
          .from("entity_item")
          .select("id, name, type:entity_type!inner(name)")
          .eq("type.name", "company")

        const { data: exactCompany, error: exactCompanyError } = await companyBaseQuery
          .eq("name", parsedIntent.entityName)
          .limit(1)
          .maybeSingle()

        if (exactCompanyError) {
          throw new Error(exactCompanyError.message)
        }

        let resolvedCompany = exactCompany as { id: string; name: string } | null
        if (!resolvedCompany) {
          const { data: fuzzyCompany, error: fuzzyCompanyError } = await supabase
            .from("entity_item")
            .select("id, name, type:entity_type!inner(name)")
            .eq("type.name", "company")
            .ilike("name", `%${parsedIntent.entityName}%`)
            .order("name")
            .limit(1)
            .maybeSingle()

          if (fuzzyCompanyError) {
            throw new Error(fuzzyCompanyError.message)
          }
          resolvedCompany = (fuzzyCompany as { id: string; name: string } | null) ?? null
        }

        if (!resolvedCompany?.id) {
          throw new Error(`기업을 찾을 수 없습니다: ${parsedIntent.entityName}`)
        }
        resolvedCompanyName = resolvedCompany.name

        const { items, error: catalogError } = await fetchCompanyMetricCatalog(supabase, {
          companyId: resolvedCompany.id,
        })
        if (catalogError) {
          throw new Error(catalogError)
        }

        const metricCatalog = mapCatalogItems(items)
        if (metricCatalog.length === 0) {
          throw new Error(`${resolvedCompany.name}에서 조회 가능한 메트릭이 없습니다.`)
        }

        selectedMetric = metricCatalog
          .map((metric) => ({ metric, score: scoreQuickMetric(metric, parsedIntent.metricQuery) }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)[0]?.metric ?? null

        if (!selectedMetric) {
          throw new Error(`메트릭을 찾을 수 없습니다: ${parsedIntent.metricQuery}`)
        }
        const targetMetric = selectedMetric

        let targetEntityId = resolvedCompany.id
        if (targetMetric.entitySource === "issuer") {
          const { data: issuerRelation, error: issuerError } = await supabase
            .from("relation_item")
            .select("to_entity_id, type:relation_type!inner(name)")
            .eq("from_entity_id", resolvedCompany.id)
            .eq("type.name", "Issuer")
            .limit(1)
            .maybeSingle()

          if (issuerError) {
            throw new Error(issuerError.message)
          }
          if (!issuerRelation?.to_entity_id) {
            throw new Error(`${resolvedCompany.name} Issuer 관계를 찾을 수 없습니다.`)
          }

          targetEntityId = issuerRelation.to_entity_id
        }

        const periodCandidates: MetricDimension[] = parsedIntent.periodMode === "auto"
          ? QUICK_PERIOD_PRIORITY.filter((period) => targetMetric.dimensions.includes(period))
          : [parsedIntent.periodMode]
        if (periodCandidates.length === 0) {
          throw new Error("선택한 메트릭에 해당 주기 데이터가 없습니다.")
        }

        let latestDate: string | null = null
        for (const period of periodCandidates) {
          const { data: latestMetric, error: latestMetricError } = await supabase
            .from("metric_item")
            .select("ts_date")
            .eq("entity_id", targetEntityId)
            .eq("type_id", targetMetric.metricTypeId)
            .eq("period_type", period)
            .order("ts_date", { ascending: false })
            .limit(1)
            .maybeSingle()

          if (latestMetricError) {
            throw new Error(latestMetricError.message)
          }

          if (latestMetric?.ts_date) {
            selectedPeriod = period
            latestDate = latestMetric.ts_date
            break
          }
        }

        if (!selectedPeriod || !latestDate) {
          throw new Error("조회 가능한 시계열 데이터가 없습니다.")
        }

        const startDate = getQuickStartDate(latestDate, parsedIntent.lookbackYears)
        const { data: dbRawItems, error: rawItemsError } = await supabase
          .from("metric_item")
          .select("ts_date, value, dimension_key, metadata")
          .eq("entity_id", targetEntityId)
          .eq("type_id", targetMetric.metricTypeId)
          .eq("period_type", selectedPeriod)
          .gte("ts_date", startDate)
          .lte("ts_date", latestDate)
          .order("ts_date", { ascending: true })

        if (rawItemsError) {
          throw new Error(rawItemsError.message)
        }
        rawItems = (dbRawItems ?? []) as QuickMetricItemRow[]
      }

      if (!selectedMetric || !selectedPeriod) {
        throw new Error("조회 가능한 시계열 데이터가 없습니다.")
      }

      const dedupByDate = new Map<string, QuickMetricItemRow>()
      for (const item of rawItems) {
        const prev = dedupByDate.get(item.ts_date)
        if (!prev) {
          dedupByDate.set(item.ts_date, item)
          continue
        }
        const prevIsBase = (prev.dimension_key ?? "") === ""
        const nextIsBase = (item.dimension_key ?? "") === ""
        if (!prevIsBase && nextIsBase) {
          dedupByDate.set(item.ts_date, item)
        }
      }

      const normalizedRows = Array.from(dedupByDate.values())
        .map((item) => {
          const numericValue = Number(item.value)
          if (!Number.isFinite(numericValue)) return null
          return {
            label: formatQuickPeriodLabel(selectedPeriod, item),
            tsDate: item.ts_date,
            value: numericValue,
          }
        })
        .filter((item): item is { label: string; tsDate: string; value: number } => item !== null)
        .sort((a, b) => a.tsDate.localeCompare(b.tsDate))

      if (normalizedRows.length === 0) {
        throw new Error("숫자형 데이터가 없어 차트를 만들 수 없습니다.")
      }

      const nextChartType = parsedIntent.chartType ?? activeBlock?.chartType ?? "chartCore/column"
      const nextChartData: ChartData = {
        xAxisType: "category",
        series: [
          {
            id: selectedMetric.metricTypeId,
            name: `${resolvedCompanyName} ${selectedMetric.label}`,
            unit: selectedMetric.unit,
            data: normalizedRows.map((row) => ({ x: row.label, y: row.value })),
          },
        ],
      }
      const nextTitle = `${resolvedCompanyName} ${selectedMetric.label}`
      const nextDescription = `${resolveCoreType(nextChartType)} · ${formatQuickPeriodType(selectedPeriod)} · 최근 ${parsedIntent.lookbackYears}년`

      if (!activeBlock) {
        const newBlockId = `blend-${Date.now()}`
        setBlocks((prev) => [
          ...prev,
          {
            id: newBlockId,
            title: nextTitle,
            description: nextDescription,
            chartType: nextChartType,
            data: nextChartData,
            style: {
              legend: { position: "none" },
              tooltip: { shared: true },
              colorPalette: BASE_PALETTE,
              chartCore: { showOutliers: true },
              timepointLine: { showOutliers: true },
            },
          },
        ])
        setActiveChartId(newBlockId)
      } else {
        setBlocks((prev) =>
          prev.map((block) => {
            if (block.id !== activeBlock.id) return block
            return {
              ...block,
              title: nextTitle,
              description: nextDescription,
              chartType: nextChartType,
              data: nextChartData,
            }
          })
        )
      }

      setJoinPreview(null)
      setBlendMessage(
        `${resolvedCompanyName} ${selectedMetric.label} ${formatQuickPeriodType(selectedPeriod)} 데이터를 최근 ${parsedIntent.lookbackYears}년 범위로 반영했습니다.`
      )
      setQuickInputDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "입력 처리 중 오류가 발생했습니다."
      setQuickInputError(message)
    } finally {
      setQuickInputLoading(false)
    }
  }, [activeBlock, quickInputValue, supabase])

  const handleBlendSources = useCallback(() => {
    if (!uploadedA && !uploadedB) {
      setJoinPreview(null)
      setBlendMessage("데이터를 하나 이상 업로드한 후 실행해 주세요.")
      return
    }
    if (!uploadedA || !uploadedB) {
      const singleSource = uploadedA ?? uploadedB
      if (!singleSource || singleSource.rows.length === 0) {
        setJoinPreview(null)
        setBlendMessage("표시할 데이터 행이 비어 있습니다. 파일 내용을 확인해 주세요.")
        return
      }

      const isSingleOhlcSource = isOhlcLikeSource(singleSource.columns, singleSource.rows)
      let nextChartData: ChartData | null = null
      let descriptionDetail = ""
      if (isSingleOhlcSource) {
        const singleSeries = buildOhlcSeriesFromRows(singleSource.rows, singleSource.fileName, `${singleSource.slot}.ohlc`)
        if (!singleSeries) {
          setJoinPreview(null)
          setBlendMessage("유효한 OHLC 행이 없어 차트는 변경되지 않았습니다.")
          return
        }
        nextChartData = buildOhlcChartData([singleSeries])
        descriptionDetail = "OHLC"
      } else {
        const slotAxisSelection = singleAxisBySlot[singleSource.slot]
        const xKeyOptions = withHeaderRowXAxisOption(singleSource.columns)
        const xKey = xKeyOptions.includes(slotAxisSelection.xKey)
          ? slotAxisSelection.xKey
          : resolveDefaultXKey(singleSource.columns, singleSource.rows)
        if (!xKey) {
          setJoinPreview(null)
          setBlendMessage("X축 컬럼이 존재하지 않습니다.")
          return
        }
        if (slotAxisSelection.yKeys.length === 0) {
          setJoinPreview(null)
          setBlendMessage("Y축이 선택되지 않았습니다.")
          return
        }
        const yCandidates = getSelectableColumns(singleSource.columns, [xKey])
        const selectedYKeys = slotAxisSelection.yKeys.filter((column) => yCandidates.includes(column))
        if (selectedYKeys.length === 0) {
          setJoinPreview(null)
          setBlendMessage("선택한 Y축 컬럼을 찾을 수 없습니다.")
          return
        }
        nextChartData = buildChartDataFromRows(singleSource.rows, xKey, selectedYKeys)
        descriptionDetail = `X: ${xKey} / Y: ${selectedYKeys.join(", ")}`
      }
      if (!nextChartData) {
        setJoinPreview(null)
        setBlendMessage("표시할 수치 컬럼이 없어 차트는 변경되지 않았습니다.")
        return
      }

      setJoinPreview(null)
      const targetChartType = activeBlock?.chartType ?? "recharts/line"
      const nextTitle = `단일 데이터 (${singleSource.fileName})`
      const nextDescription = `${resolveCoreType(targetChartType)} · 단일 데이터 · ${descriptionDetail}`
      if (!activeBlock) {
        const newBlockId = `blend-${Date.now()}`
        setBlocks((prev) => [
          ...prev,
          {
            id: newBlockId,
            title: nextTitle,
            description: nextDescription,
            chartType: targetChartType,
            data: nextChartData,
            style: {
              legend: { position: "none" },
              tooltip: { shared: true },
              colorPalette: BASE_PALETTE,
              chartCore: { showOutliers: true },
              timepointLine: { showOutliers: true },
            },
          },
        ])
        setActiveChartId(newBlockId)
        setBlendMessage(`표시 완료: ${singleSource.fileName} / ${descriptionDetail} / ${singleSource.rows.length}행 (새 차트 생성)`)
        return
      }

      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== activeBlock.id) return block
          return {
            ...block,
            title: nextTitle,
            description: nextDescription,
            data: nextChartData,
          }
        })
      )
      setBlendMessage(`표시 완료: ${singleSource.fileName} / ${descriptionDetail} / ${singleSource.rows.length}행`)
      return
    }
    const isBothOhlcSource =
      isOhlcLikeSource(uploadedA.columns, uploadedA.rows) &&
      isOhlcLikeSource(uploadedB.columns, uploadedB.rows)
    if (isBothOhlcSource) {
      const seriesA = buildOhlcSeriesFromRows(uploadedA.rows, uploadedA.fileName, "A.ohlc")
      const seriesB = buildOhlcSeriesFromRows(uploadedB.rows, uploadedB.fileName, "B.ohlc")
      const nextChartData = buildOhlcChartData(
        [seriesA, seriesB].filter((series): series is NonNullable<typeof series> => Boolean(series))
      )
      if (!nextChartData) {
        setJoinPreview(null)
        setBlendMessage("유효한 OHLC 행이 없어 차트는 변경되지 않았습니다.")
        return
      }
      setJoinPreview(null)
      const targetChartType = activeBlock?.chartType ?? "recharts/line"
      const nextTitle = `OHLC 오버레이 (${uploadedA.fileName} + ${uploadedB.fileName})`
      const nextDescription = `${resolveCoreType(targetChartType)} · OHLC 오버레이`
      if (!activeBlock) {
        const newBlockId = `blend-${Date.now()}`
        setBlocks((prev) => [
          ...prev,
          {
            id: newBlockId,
            title: nextTitle,
            description: nextDescription,
            chartType: targetChartType,
            data: nextChartData,
            style: {
              legend: { position: "none" },
              tooltip: { shared: true },
              colorPalette: BASE_PALETTE,
              chartCore: { showOutliers: true },
              timepointLine: { showOutliers: true },
            },
          },
        ])
        setActiveChartId(newBlockId)
        setBlendMessage(`OHLC 오버레이 표시 완료: A ${uploadedA.rows.length}행 / B ${uploadedB.rows.length}행 (새 차트 생성)`)
        return
      }

      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== activeBlock.id) return block
          return {
            ...block,
            title: nextTitle,
            description: nextDescription,
            data: nextChartData,
          }
        })
      )
      setBlendMessage(`OHLC 오버레이 표시 완료: A ${uploadedA.rows.length}행 / B ${uploadedB.rows.length}행 (join 설정 무시)`)
      return
    }
    if (isAppendMode) {
      if (!appendedSourcesForAxis || appendedRowsForAxis.length === 0) {
        setJoinPreview(null)
        setBlendMessage("시리즈 병합에 사용할 데이터 행이 없습니다.")
        return
      }

      if (!appendResolvedXKey) {
        setJoinPreview(null)
        setBlendMessage("병합 결과에 사용할 X축 컬럼이 존재하지 않습니다.")
        return
      }

      if (appendSelectedYKeys.length === 0) {
        setJoinPreview(null)
        setBlendMessage("병합 결과에 사용할 Y축이 선택되지 않았습니다.")
        return
      }

      const nextChartData = buildChartDataFromRows(appendedRowsForAxis, appendResolvedXKey, appendSelectedYKeys)
      if (!nextChartData) {
        setJoinPreview(null)
        setBlendMessage("시리즈 병합 결과로 만들 수 있는 차트 데이터가 없습니다.")
        return
      }

      setJoinPreview(null)
      const targetChartType = activeBlock?.chartType ?? "recharts/line"
      const nextTitle = `시리즈 병합 결과 (${uploadedA.fileName} + ${uploadedB.fileName})`
      const nextDescription = `${resolveCoreType(targetChartType)} · ${JOIN_TYPE_LABELS[joinType]} · X: ${appendResolvedXKey} · Y: ${appendSelectedYKeys.join(", ")}`
      if (!activeBlock) {
        const newBlockId = `blend-${Date.now()}`
        setBlocks((prev) => [
          ...prev,
          {
            id: newBlockId,
            title: nextTitle,
            description: nextDescription,
            chartType: targetChartType,
            data: nextChartData,
            style: {
              legend: { position: "none" },
              tooltip: { shared: true },
              colorPalette: BASE_PALETTE,
              chartCore: { showOutliers: true },
              timepointLine: { showOutliers: true },
            },
          },
        ])
        setActiveChartId(newBlockId)
        setBlendMessage(
          `시리즈 병합 완료: ${uploadedA.rows.length + uploadedB.rows.length}행 / X: ${appendResolvedXKey} / Y: ${appendSelectedYKeys.join(", ")} (새 차트 생성)`
        )
        return
      }

      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== activeBlock.id) return block
          return {
            ...block,
            title: nextTitle,
            description: nextDescription,
            data: nextChartData,
          }
        })
      )
      setBlendMessage(
        `시리즈 병합 완료: ${uploadedA.rows.length + uploadedB.rows.length}행 / X: ${appendResolvedXKey} / Y: ${appendSelectedYKeys.join(", ")}`
      )
      return
    }
    if (joinKeyOptions.length === 0 || !joinKey) {
      setJoinPreview(null)
      setBlendMessage("결합 키를 선택해 주세요.")
      return
    }
    if (uploadedA.rows.length === 0 || uploadedB.rows.length === 0) {
      setJoinPreview(null)
      setBlendMessage("A/B 데이터 행이 비어 있습니다. CSV 내용을 확인해 주세요.")
      return
    }

    if (!normalizedSourceA || !normalizedSourceB) {
      setJoinPreview(null)
      setBlendMessage("결합용 정규화 데이터 생성에 실패했습니다.")
      return
    }

    const joinedRows = joinRows(
      normalizedSourceA.rows,
      normalizedSourceB.rows,
      normalizedSourceA.columns,
      normalizedSourceB.columns,
      joinKey,
      joinType
    )
    const preview = buildJoinPreview(normalizedSourceA.rows, normalizedSourceB.rows, joinKey, joinType, joinedRows.length)
    setJoinPreview(preview)

    if (joinAxisSelection.yKeys.length === 0) {
      setBlendMessage("Y축이 선택되지 않았습니다.")
      return
    }

    if (!joinResolvedXKey) {
      setBlendMessage("X축 컬럼이 존재하지 않습니다.")
      return
    }

    if (joinSelectedYKeys.length === 0) {
      setBlendMessage("선택한 Y축 컬럼을 찾을 수 없습니다.")
      return
    }

    const nextChartData = buildChartDataFromRows(joinedRows, joinResolvedXKey, joinSelectedYKeys)
    if (!nextChartData) {
      setBlendMessage(`결합 완료: ${JOIN_TYPE_LABELS[joinType]} / 키: ${joinKey} (수치 컬럼이 없어 차트는 변경되지 않았습니다.)`)
      return
    }

    const targetChartType = activeBlock?.chartType ?? "recharts/line"
    const nextTitle = `혼합 결과 (${uploadedA.fileName} + ${uploadedB.fileName})`
    const nextDescription = `${resolveCoreType(targetChartType)} · ${JOIN_TYPE_LABELS[joinType]} · X: ${joinResolvedXKey} · Y: ${joinSelectedYKeys.join(", ")}`
    if (!activeBlock) {
      const newBlockId = `blend-${Date.now()}`
      setBlocks((prev) => [
        ...prev,
        {
          id: newBlockId,
          title: nextTitle,
          description: nextDescription,
          chartType: targetChartType,
          data: nextChartData,
          style: {
            legend: { position: "none" },
            tooltip: { shared: true },
            colorPalette: BASE_PALETTE,
            chartCore: { showOutliers: true },
            timepointLine: { showOutliers: true },
          },
        },
      ])
      setActiveChartId(newBlockId)
      setBlendMessage(
        `결합 완료: ${JOIN_TYPE_LABELS[joinType]} / 키: ${joinKey} / ${joinedRows.length}행 (정규화 A:${normalizedSourceA.normalizationMode}, B:${normalizedSourceB.normalizationMode}) (새 차트 생성)`
      )
      return
    }

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== activeBlock.id) return block
        return {
          ...block,
          title: nextTitle,
          description: nextDescription,
          data: nextChartData,
        }
      })
    )
    setBlendMessage(
      `결합 완료: ${JOIN_TYPE_LABELS[joinType]} / 키: ${joinKey} / ${joinedRows.length}행 (정규화 A:${normalizedSourceA.normalizationMode}, B:${normalizedSourceB.normalizationMode})`
    )
  }, [activeBlock, appendResolvedXKey, appendSelectedYKeys, appendedRowsForAxis, appendedSourcesForAxis, isAppendMode, joinAxisSelection.yKeys.length, joinKey, joinKeyOptions.length, joinResolvedXKey, joinSelectedYKeys, joinType, normalizedSourceA, normalizedSourceB, singleAxisBySlot, uploadedA, uploadedB])

  const activeBlockId = activeBlock?.id ?? "__empty__"
  const chartState = getChartState(activeBlockId)
  const activeLegendState = legendStateByChartId[activeBlockId] ?? {
    tooltipPayload: null,
    hoveredLabel: null,
    treemapStats: null,
    chartCoreLegendMeta: null,
  }
  const seriesColorMap = activeBlock
    ? getSeriesDisplayColors(activeBlock, chartState.seriesColors)
    : {}
  const outlierCount = activeBlock ? getOutlierCount(activeBlock) : 0
  const canShowOutliers = activeBlock ? isOutlierSupported(activeBlock) && outlierCount > 0 : false
  const hasData = activeBlock ? hasRenderableSeries(activeBlock) : false
  const appliedStyle = activeBlock
    ? applyViewStateToStyle(
      activeBlock,
      canShowOutliers && chartState.showOutliers,
      chartState.showTooltip,
      chartState.seriesColors
    )
    : undefined

  useEffect(() => {
    // 미지원/비정상 상태에서는 표시 플래그를 자동 정리해 이후 상태 오염을 막는다.
    if (!activeBlock) return
    if (canShowOutliers || !chartState.showOutliers) return
    setShowOutliers(activeBlock.id, false)
  }, [activeBlock, canShowOutliers, chartState.showOutliers, setShowOutliers])

  const handleDerivedSectionElementChange = useCallback((node: HTMLElement | null) => {
    setDerivedSectionElement(node)
  }, [])

  if (!activeBlock) return null

  return (
    <Page direction="horizontal" className="relative h-screen w-full min-w-0 flex-1">
      <Panel
        variant="fixed"
        bordered
        className={cn(
          "shrink-0 transition-all duration-200",
          isSidePanelOpen ? "w-[280px]" : "w-0 border-r-0 opacity-0 pointer-events-none"
        )}
      >
        {isSidePanelOpen && (
          <>
            <PanelBody className="px-3 py-2">
              <Tabs value={sideTab} onValueChange={(value) => setSideTab(value as "data" | "series" | "style")}>
                <div className="space-y-1.5 pb-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">차트 선택</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setIsSidePanelCollapsed(true)}
                    >
                      <ChevronsLeft />
                    </Button>
                  </div>
                  <div ref={chartTypeSelectContainerRef}>
                    <Select
                      open={chartTypeSelectOpen}
                      onOpenChange={setChartTypeSelectOpen}
                      value={activeBlock.chartType}
                      onValueChange={(value) => handleActiveChartTypeChange(value as ChartType)}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-full h-8 text-xs"
                        aria-label={`차트 타입: ${activeChartTypeOption?.label ?? "차트 타입 선택"}`}
                      >
                        {activeChartTypeOption ? (
                          <ChartTypeSelectLabel option={activeChartTypeOption} />
                        ) : (
                          <span className="text-muted-foreground">차트 타입 선택</span>
                        )}
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        className="w-[var(--radix-select-trigger-width)]"
                        style={chartTypeSelectMaxHeight != null ? { maxHeight: `${chartTypeSelectMaxHeight}px` } : undefined}
                      >
                        {chartTypeOptionsForControl.map((option) => {
                          const isCurrent = option.value === activeBlock.chartType
                          const isCompatible = compatibleTypeSet.has(option.value)
                          const isDisabled = !isCurrent && !isCompatible
                          return (
                            <SelectItem key={option.value} value={option.value} disabled={isDisabled}>
                              <ChartTypeSelectLabel
                                option={{
                                  label: `${option.label}${isDisabled ? " (incompatible)" : ""}`,
                                  iconKey: option.iconKey,
                                }}
                                disabled={isDisabled}
                              />
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <TabsList className="w-full">
                  <TabsTrigger value="data" className="flex-1 text-xs">데이터</TabsTrigger>
                  <TabsTrigger value="series" className="flex-1 text-xs">시리즈</TabsTrigger>
                  <TabsTrigger value="style" className="flex-1 text-xs">스타일</TabsTrigger>
                </TabsList>

                <TabsContent value="data" className="mt-2">
                  <SeriesAdditionPanel
                    activeBlock={activeBlock}
                    onUpdateBlock={(data, title, description) => {
                      if (!activeBlock) return
                      setBlocks((prev) =>
                        prev.map((block) => {
                          if (block.id !== activeBlock.id) return block
                          return { ...block, data, title, description }
                        })
                      )
                    }}
                    onCreateBlock={(data, title, description, chartType) => {
                      const newBlockId = `blend-${Date.now()}`
                      setBlocks((prev) => [
                        ...prev,
                        {
                          id: newBlockId,
                          title,
                          description,
                          chartType,
                          data,
                          style: {
                            legend: { position: "none" },
                            tooltip: { shared: true },
                            colorPalette: BASE_PALETTE,
                            chartCore: { showOutliers: true },
                            timepointLine: { showOutliers: true },
                          },
                        },
                      ])
                      setActiveChartId(newBlockId)
                    }}
                    uploadedSources={{
                      A: uploadedA ?? null,
                      B: uploadedB ?? null,
                    }}
                    onOpenUploadDialog={() => {
                      setUploadError(null)
                      setUploadDialogOpen(true)
                    }}
                    onDerivedSectionElementChange={handleDerivedSectionElementChange}
                  />
                </TabsContent>

                <TabsContent value="series" className="mt-2">
                  {isActiveChartCoreType ? (
                    <div key={`chartcore-legend-host-${activeBlock.id}`} className="space-y-2">
                      <div ref={handleChartCoreLegendHostRef} className="min-h-[160px]" />
                      {!chartCoreLegendContainer && (
                        <p className="text-xs text-muted-foreground">legend 로딩 중...</p>
                      )}
                    </div>
                  ) : (
                    <SeriesPanelContent
                      activeBlock={activeBlock}
                      seriesColors={chartState.seriesColors}
                      tooltipPayload={activeLegendState.tooltipPayload}
                      hoveredLabel={activeLegendState.hoveredLabel}
                      treemapStats={activeLegendState.treemapStats}
                      onBlockStyleChange={updateBlockStyle}
                    />
                  )}
                </TabsContent>

                <TabsContent value="style" className="mt-2">
                  <StylePanelContent
                    activeBlock={activeBlock}
                    outlierCount={outlierCount}
                    chartCoreLegendMeta={activeLegendState.chartCoreLegendMeta}
                    onBlockStyleChange={updateBlockStyle}
                    showOutliers={chartState.showOutliers}
                    showTooltip={chartState.showTooltip}
                    showLegend={chartState.showLegend}
                    seriesColors={chartState.seriesColors}
                    groupColors={chartState.groupColors}
                    onShowOutliersChange={setShowOutliers}
                    onShowTooltipChange={setShowTooltip}
                    onShowLegendChange={setShowLegend}
                    onSetSeriesColor={setSeriesColor}
                    onRemoveSeriesColor={removeSeriesColor}
                    onSetGroupColor={setGroupColor}
                    onRemoveGroupColor={removeGroupColor}
                    compact
                  />
                </TabsContent>
              </Tabs>

              <Dialog open={quickInputDialogOpen} onOpenChange={setQuickInputDialogOpen}>
                <DialogContent className="sm:max-w-[420px]">
                  <DialogHeader>
                    <DialogTitle className="text-base">입력 팝업</DialogTitle>
                    <DialogDescription>
                      문장을 해석해 기업/메트릭 데이터를 조회하고 현재 차트에 반영합니다.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
                    <Label htmlFor="quick-input" className="text-xs">입력 값</Label>
                    <Input
                      id="quick-input"
                      className="h-8 text-xs"
                      value={quickInputValue}
                      onChange={(event) => {
                        setQuickInputValue(event.target.value)
                        setQuickInputError(null)
                      }}
                      placeholder="예: 삼성증권의 지난 5년간 매출액을 바 차트로 보여줘"
                    />
                    {USE_MOCK_SECTORBOOK_PROVIDER && (
                      <div className="space-y-1 rounded-sm border border-border p-2">
                        <p className="text-[11px] font-medium">추천 지표 (Top 3)</p>
                        {quickInputRecommendLoading ? (
                          <p className="text-[11px] text-muted-foreground">추천 항목을 조회하는 중입니다.</p>
                        ) : quickInputRecommendations.length > 0 ? (
                          <div className="space-y-1">
                            {quickInputRecommendations.map((item) => (
                              <button
                                key={`${item.companyId}:${item.metricKey}`}
                                type="button"
                                className="flex w-full items-center justify-between rounded-sm border border-border px-2 py-1 text-left text-[11px] hover:bg-secondary/60"
                                onClick={() => {
                                  setQuickInputValue(item.queryText)
                                  setQuickInputError(null)
                                }}
                              >
                                <span className="truncate">{item.queryText}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">추천 결과가 없습니다.</p>
                        )}
                        {quickInputRecommendError && (
                          <p className="text-[11px] text-destructive">{quickInputRecommendError}</p>
                        )}
                      </div>
                    )}
                    {quickInputError && (
                      <p className="text-[11px] text-destructive">{quickInputError}</p>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={quickInputLoading}
                      onClick={() => {
                        setQuickInputDialogOpen(false)
                        setQuickInputError(null)
                      }}
                    >
                      취소
                    </Button>
                    <Button type="button" onClick={() => void handleQuickInputSubmit()} disabled={quickInputLoading}>
                      {quickInputLoading ? "조회 중..." : "적용"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle className="text-base">데이터 업로드</DialogTitle>
                    <DialogDescription>
                      슬롯 A/B에 파일을 업로드하고 결합 준비를 진행합니다. (CSV 컬럼 자동 분석)
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">업로드 대상 슬롯</Label>
                      <Select value={uploadTargetSlot} onValueChange={(value) => setUploadTargetSlot(value as UploadSlotId)}>
                        <SelectTrigger size="sm" className="w-full h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">기준 데이터 (A)</SelectItem>
                          <SelectItem value="B">보조 데이터 (B)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="upload-file" className="text-xs">파일 선택</Label>
                      <Input
                        id="upload-file"
                        type="file"
                        className="h-8 text-xs file:h-6 file:text-xs"
                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setPendingUploadFile(file)
                          setUploadError(null)
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        지원 형식: CSV, XLSX, XLS
                      </p>
                    </div>

                    {pendingUploadFile && (
                      <div className="rounded-sm border border-border p-2 text-[11px] text-muted-foreground">
                        <p className="font-medium text-foreground">{pendingUploadFile.name}</p>
                        <p>{formatFileSize(pendingUploadFile.size)}</p>
                      </div>
                    )}

                    {uploadError && (
                      <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
                        {uploadError}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setUploadDialogOpen(false)
                        setPendingUploadFile(null)
                        setUploadError(null)
                      }}
                    >
                      취소
                    </Button>
                    <Button
                      type="button"
                      onClick={handleUploadConfirm}
                      disabled={!pendingUploadFile || isUploading}
                    >
                      {isUploading ? "업로드 중..." : "업로드"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <PageHDbDialog
                open={dbDialogOpen}
                onOpenChange={setDbDialogOpen}
                targetSlot={dbTargetSlot}
                onTargetSlotChange={setDbTargetSlot}
                searchTerm={dbSearchTerm}
                onSearchTermChange={setDbSearchTerm}
                companies={dbCompanies}
                selectedCompanyId={activeDbSelection.companyId}
                onSelectedCompanyIdChange={handleDbCompanySelect}
                queryMode={activeDbSelection.queryMode}
                onQueryModeChange={handleDbQueryModeChange}
                selectedMetric={activeDbSelection.metricKey}
                onSelectedMetricChange={handleDbMetricChange}
                metricOptions={availableDbMetricOptions}
                selectedDimension={activeDbSelection.dimensionKey}
                onSelectedDimensionChange={handleDbDimensionChange}
                dimensionOptions={availableDbDimensionOptions}
                dateRange={dbDateRange}
                onDateRangeChange={handleDbDateRangeChange}
                previewColumns={
                  activeDbPreview?.columns ??
                  (activeDbSelection.queryMode === "ohlcv" ? DB_OHLCV_COLUMNS : DB_METRIC_VALUE_COLUMNS)
                }
                rows={activeDbPreview?.rows ?? []}
                companyName={activeDbPreview?.companyName ?? ""}
                isCompaniesLoading={isDbCompaniesLoading}
                isMetricsLoading={isDbMetricsLoading}
                isPreviewLoading={isDbPreviewLoading}
                error={dbError}
                canFetchPreview={canFetchDbPreview}
                onSearchCompanies={handleDbCompanySearch}
                onFetchPreview={handleDbPreviewFetch}
                onApply={handleApplyDbRows}
              />
            </PanelBody>
          </>
        )}
      </Panel>

      {!isSidePanelOpen && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-2 left-2 z-30"
          onClick={() => setIsSidePanelCollapsed(false)}
          aria-label="패널 1/2/3 펼치기"
        >
          <ChevronsRight />
        </Button>
      )}

      <Panel variant="flex">
        <PanelHeader className="px-3 py-2">
          <div className="w-full flex items-start justify-between gap-3">
            <div className="min-w-0" style={{ marginLeft: chartHeaderTitleOffset }}>
              <p className="text-[13px] font-medium">{activeBlock.title}</p>
              <p className="text-[11px] text-muted-foreground">{activeBlock.description}</p>
            </div>
          </div>
        </PanelHeader>
        <PanelBody className="space-y-2 px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {blocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => setActiveChartId(block.id)}
                className={cn(
                  "text-left rounded-sm border px-2 py-1.5 transition-colors",
                  block.id === activeBlock.id ? "border-primary/60 bg-primary/5" : "border-border hover:bg-accent/50"
                )}
              >
                <p className="text-xs font-medium">{block.title}</p>
              </button>
            ))}
          </div>

          <div
            className={cn(
              "relative rounded-sm border",
              isActiveChartCoreType ? "border-transparent" : "border-border",
              !chartState.showTooltip && "blended-tooltip-off"
            )}
          >
            {chartState.showLegend && hasData && (
              <ChartLegendOverlay
                block={activeBlock}
                colorMap={seriesColorMap}
                chartCoreLegendMeta={activeLegendState.chartCoreLegendMeta}
              />
            )}
            <div className="h-[460px]">
              <DataChart
                data={activeBlock.data}
                chartType={activeBlock.chartType}
                style={appliedStyle}
                scenario={
                  activeBlock.chartType === "lightweight/candles"
                    ? ((appliedStyle as CartesianStyle | undefined)?.lightweightCandles?.scenario ?? "BASE")
                    : undefined
                }
                onLegendStateChange={handleLegendStateChange}
                hideChartCoreLegendPanel={true}
                chartCoreLegendContainer={isActiveChartCoreType ? chartCoreLegendContainer : null}
                chartCoreSeriesColorOverrides={isActiveChartCoreType ? chartState.seriesColors : undefined}
                chartCoreGroupColorOverrides={isActiveChartCoreType ? chartState.groupColors : undefined}
                onChartCoreLegendMetaChange={isActiveChartCoreType ? handleChartCoreLegendMetaChange : undefined}
                isEmpty={!hasData}
                emptyMessage="시리즈 데이터가 없어 차트를 렌더링할 수 없습니다."
              />
            </div>
          </div>
        </PanelBody>
      </Panel>

      <style jsx global>{`
        .blended-tooltip-off .recharts-tooltip-wrapper,
        .blended-tooltip-off [data-state][role="tooltip"],
        .blended-tooltip-off [role="tooltip"] {
          display: none !important;
        }
      `}</style>
    </Page>
  )
}

export default function ChartBlockCardBody() {
  return (
    <BlendedChartViewProvider>
      <Phase3Screen />
    </BlendedChartViewProvider>
  )
}
