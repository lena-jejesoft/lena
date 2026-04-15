import type { ChartData, OHLCPoint } from "@/packages/chart-lib/types"

export type AdapterCellValue = string | number | null
export type AdapterRow = Record<string, AdapterCellValue>
export const HEADER_ROW_X_KEY = "__header_row__"
export const NORMALIZED_ENTITY_KEY = "entityKey"
export const NORMALIZED_TIME_KEY = "timeKey"
export const NORMALIZED_METRIC_KEY = "metricKey"
export const NORMALIZED_VALUE_KEY = "value"
export const BLEND_MAPPING_HEADER_TIME_KEY = "__header_time__"
export const BLEND_MAPPING_HEADER_VALUE_KEY = "__header_value__"

export type JoinType = "append" | "left" | "inner" | "full" | "right"

export type JoinPreview = {
  joinType: JoinType
  joinKey: string
  outputRows: number
  sourceRowsA: number
  sourceRowsB: number
  matchedRowsA: number
  matchedRowsB: number
  matchRateA: number
  matchRateB: number
}

export type NormalizedBlendSource = {
  columns: string[]
  rows: AdapterRow[]
  normalizationMode: "identity" | "row-canonical" | "wide-to-long"
}

export type BlendSemanticMapping = {
  entityColumn: string
  timeColumn: string
  metricColumn: string
  valueColumn: string
}

export type BlendSemanticInference = BlendSemanticMapping & {
  mode: NormalizedBlendSource["normalizationMode"]
}

type OhlcvLikeRow = {
  ts_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  turnover: number | null
}

export const DEFAULT_OHLC_REQUIRED_COLUMNS: readonly string[] = ["ts_date", "open", "high", "low", "close"]

export function mapMetricRowsToPreviewRows(
  rows: Array<{ ts_date: string; value: number }>,
  valueColumnKey = "value"
): AdapterRow[] {
  return rows.map((row) => ({
    ts_date: row.ts_date,
    [valueColumnKey]: row.value,
  }))
}

export function mapOhlcvRowsToPreviewRows(rows: OhlcvLikeRow[]): AdapterRow[] {
  return rows.map((row) => ({
    ts_date: row.ts_date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    turnover: row.turnover,
  }))
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuote = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]
    if (char === "\"") {
      if (inQuote && next === "\"") {
        current += "\""
        i += 1
        continue
      }
      inQuote = !inQuote
      continue
    }
    if (!inQuote && char === delimiter) {
      values.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  values.push(current.trim())
  return values.map((value) => value.replace(/^\uFEFF/, ""))
}

function detectDelimiter(headerLine: string): string {
  const candidates = [",", "\t", ";", "|"]
  let best = ","
  let bestCount = -1
  candidates.forEach((candidate) => {
    const count = headerLine.split(candidate).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  })
  return best
}

function normalizeCsvValue(value: string): AdapterCellValue {
  const trimmed = value.trim()
  if (trimmed === "") return null
  const numericCandidate = trimmed.replace(/,/g, "")
  if (/^-?\d+(\.\d+)?$/.test(numericCandidate)) {
    const parsed = Number(numericCandidate)
    if (Number.isFinite(parsed)) return parsed
  }
  return trimmed
}

function normalizeSpreadsheetValue(value: unknown): AdapterCellValue {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  if (typeof value === "boolean") return value ? "true" : "false"
  return normalizeCsvValue(String(value))
}

function normalizeSpreadsheetColumns(headerRow: unknown[]): string[] {
  const usedNames = new Map<string, number>()
  return headerRow.map((cell, index) => {
    const base = String(cell ?? "")
      .replace(/^\uFEFF/, "")
      .trim() || `column_${index + 1}`
    const duplicated = usedNames.get(base) ?? 0
    usedNames.set(base, duplicated + 1)
    if (duplicated === 0) return base
    return `${base}_${duplicated + 1}`
  })
}

export type ExtractedUploadData = {
  columns: string[]
  rowCount: number | null
  rows: AdapterRow[]
}

async function extractSpreadsheetData(file: File): Promise<ExtractedUploadData> {
  const XLSX = await import("xlsx")
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
    raw: true,
  })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return { columns: [], rowCount: 0, rows: [] }
  const firstSheet = workbook.Sheets[firstSheetName]
  if (!firstSheet) return { columns: [], rowCount: 0, rows: [] }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  if (matrix.length === 0) return { columns: [], rowCount: 0, rows: [] }

  const headerRow = Array.isArray(matrix[0]) ? matrix[0] : []
  const columns = normalizeSpreadsheetColumns(headerRow)
  const rows = matrix
    .slice(1)
    // 빈 행 제거로 join 결과 왜곡을 막는다.
    .filter((row) => Array.isArray(row) && row.some((cell) => normalizeSpreadsheetValue(cell) != null))
    .map((row) => {
      const rowValues = Array.isArray(row) ? row : []
      const normalizedRow: AdapterRow = {}
      columns.forEach((column, index) => {
        normalizedRow[column] = normalizeSpreadsheetValue(rowValues[index])
      })
      return normalizedRow
    })

  return {
    columns,
    rowCount: rows.length,
    rows,
  }
}

export async function extractUploadData(file: File): Promise<ExtractedUploadData> {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return extractSpreadsheetData(file)
  }
  if (!fileName.endsWith(".csv")) {
    // 미지원 형식은 메타만 유지해 재업로드를 유도한다.
    return { columns: [], rowCount: null, rows: [] }
  }

  const raw = await file.text()
  const lines = raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { columns: [], rowCount: 0, rows: [] }
  }

  const delimiter = detectDelimiter(lines[0]!)
  const columns = parseCsvLine(lines[0]!, delimiter)
    .map((column) => column.trim())
    .filter((column) => column.length > 0)
  const rowCount = Math.max(lines.length - 1, 0)
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter)
    const row: AdapterRow = {}
    columns.forEach((column, index) => {
      row[column] = normalizeCsvValue(values[index] ?? "")
    })
    return row
  })

  return { columns, rowCount, rows }
}

function toJoinKey(value: string | number | null | undefined): string {
  if (value == null) return ""
  return String(value).trim()
}

function toNumericValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const normalized = value.trim()
    if (!normalized) return null

    const percentTrimmed = normalized.endsWith("%")
      ? normalized.slice(0, -1).trim()
      : normalized
    const signNormalized = percentTrimmed.replace(/^\((.*)\)$/, "-$1")
    const numericCandidate = signNormalized.replace(/,/g, "")
    const parsed = Number(numericCandidate)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toTimestampValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    return value < 1_000_000_000_000 ? value * 1000 : value
  }
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized) return null
  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized)
    if (!Number.isFinite(numeric)) return null
    return normalized.length <= 10 ? numeric * 1000 : numeric
  }
  const parsed = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function toLowerNormalizedText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "")
}

function includesAlias(columnName: string, aliases: string[]): boolean {
  const normalized = toLowerNormalizedText(columnName)
  return aliases.some((alias) => normalized.includes(alias))
}

export function isPeriodLikeColumnName(columnName: string): boolean {
  const normalized = columnName.trim()
  if (!normalized) return false
  if (/^\d{4}([./-](0?[1-9]|1[0-2]))?$/.test(normalized)) return true
  if (/^\d{4}\s*[-/.]?\s*Q[1-4]$/i.test(normalized)) return true
  if (/^\d{4}\s*Q[1-4]$/i.test(normalized)) return true
  if (/^Q[1-4]\s*\d{4}$/i.test(normalized)) return true
  if (/^제?\s*\d+\s*기$/.test(normalized)) return true
  if (/^fy\s*\d{4}$/i.test(normalized)) return true
  return false
}

function pickColumnByAliases(columns: string[], aliases: string[], excludedColumns: Set<string>): string | null {
  return columns.find((column) => !excludedColumns.has(column) && includesAlias(column, aliases)) ?? null
}

function getDistinctCount(rows: AdapterRow[], column: string): number {
  return new Set(
    rows
      .map((row) => toJoinKey(row[column]))
      .filter((value) => value.length > 0)
  ).size
}

function pickMostDistinctColumn(rows: AdapterRow[], columns: string[]): string | null {
  if (columns.length === 0) return null
  let best = columns[0]!
  let bestCount = -1
  columns.forEach((column) => {
    const distinct = getDistinctCount(rows, column)
    if (distinct > bestCount) {
      best = column
      bestCount = distinct
    }
  })
  return best
}

function pickLikelyTimeColumn(rows: AdapterRow[], columns: string[], excludedColumns: Set<string>): string | null {
  const aliasMatch = pickColumnByAliases(columns, ["ts_date", "date", "time", "period", "연도", "년도", "년", "월", "분기", "기"], excludedColumns)
  if (aliasMatch) return aliasMatch

  let best: string | null = null
  let bestScore = 0
  columns.forEach((column) => {
    if (excludedColumns.has(column)) return
    let validCount = 0
    rows.forEach((row) => {
      if (toTimestampValue(row[column]) != null) validCount += 1
    })
    const score = rows.length > 0 ? validCount / rows.length : 0
    if (score > bestScore) {
      best = column
      bestScore = score
    }
  })
  return bestScore >= 0.6 ? best : null
}

function pickLikelyValueColumn(rows: AdapterRow[], columns: string[], excludedColumns: Set<string>): string | null {
  let best: string | null = null
  let bestScore = -1
  columns.forEach((column) => {
    if (excludedColumns.has(column)) return
    let numericCount = 0
    rows.forEach((row) => {
      if (toNumericValue(row[column]) != null) numericCount += 1
    })
    const score = rows.length > 0 ? numericCount / rows.length : 0
    if (score > bestScore) {
      best = column
      bestScore = score
    }
  })
  if (bestScore <= 0) return null
  return best
}

function uniqueColumns(columns: string[]): string[] {
  return Array.from(new Set(columns))
}

function pickFirstDifferentColumn(columns: string[], excluded: Array<string | null | undefined>): string {
  const excludedSet = new Set(excluded.filter((value): value is string => Boolean(value)))
  const candidate = columns.find((column) => !excludedSet.has(column))
  return candidate ?? columns[0] ?? ""
}

function resolveEffectivePeriodColumns(rows: AdapterRow[], columns: string[], excludedColumns: Set<string>): string[] {
  const periodLike = columns.filter((column) => !excludedColumns.has(column) && isPeriodLikeColumnName(column))
  if (periodLike.length > 0) return periodLike
  return columns.filter((column) => {
    if (excludedColumns.has(column)) return false
    return rows.some((row) => toNumericValue(row[column]) != null)
  })
}

function isMappingColumnValue(columnValue: string, columns: string[]): boolean {
  if (!columnValue) return false
  if (columnValue === BLEND_MAPPING_HEADER_TIME_KEY || columnValue === BLEND_MAPPING_HEADER_VALUE_KEY) return true
  return columns.includes(columnValue)
}

export function inferBlendSemanticMapping(
  rows: AdapterRow[],
  columns: string[]
): BlendSemanticInference {
  if (rows.length === 0 || columns.length === 0) {
    return {
      entityColumn: columns[0] ?? "",
      timeColumn: columns[0] ?? "",
      metricColumn: columns[0] ?? "",
      valueColumn: columns[0] ?? "",
      mode: "identity",
    }
  }

  const periodColumns = columns.filter((column) => isPeriodLikeColumnName(column))
  const excludedForEntity = new Set(periodColumns)
  const entityColumn =
    pickColumnByAliases(columns, ["entity", "company", "기업", "회사", "부문", "사업부", "segment", "division"], excludedForEntity) ??
    pickMostDistinctColumn(rows, columns.filter((column) => !excludedForEntity.has(column))) ??
    columns[0] ??
    ""

  const metricExcluded = new Set<string>([...periodColumns, entityColumn])
  const metricColumn =
    pickColumnByAliases(columns, ["metric", "지표", "계정", "과목", "품목", "제품", "item", "항목"], metricExcluded) ??
    pickMostDistinctColumn(rows, columns.filter((column) => !metricExcluded.has(column))) ??
    pickFirstDifferentColumn(columns, [entityColumn])

  const timeColumnAlias = pickColumnByAliases(columns, ["ts_date", "date", "time", "period", "연도", "년도", "년", "월", "분기", "기"], new Set())
  const shouldWideToLong = periodColumns.length >= 2 && (!timeColumnAlias || periodColumns.includes(timeColumnAlias))

  if (shouldWideToLong) {
    return {
      entityColumn,
      timeColumn: BLEND_MAPPING_HEADER_TIME_KEY,
      metricColumn,
      valueColumn: BLEND_MAPPING_HEADER_VALUE_KEY,
      mode: "wide-to-long",
    }
  }

  const timeExcluded = new Set<string>([entityColumn, metricColumn])
  const timeColumn =
    pickLikelyTimeColumn(rows, columns, timeExcluded) ??
    pickFirstDifferentColumn(columns, [entityColumn, metricColumn])
  const valueExcluded = new Set<string>([entityColumn, metricColumn, timeColumn])
  const valueColumn =
    pickLikelyValueColumn(rows, columns, valueExcluded) ??
    pickLikelyValueColumn(rows, columns, new Set()) ??
    pickFirstDifferentColumn(columns, [entityColumn, metricColumn, timeColumn])

  return {
    entityColumn,
    timeColumn,
    metricColumn,
    valueColumn,
    mode: "row-canonical",
  }
}

export function normalizeSourceRowsForBlend(
  rows: AdapterRow[],
  columns: string[],
  mappingOverride?: Partial<BlendSemanticMapping>
): NormalizedBlendSource {
  if (columns.length === 0) {
    return {
      columns,
      rows,
      normalizationMode: "identity",
    }
  }

  if (rows.length === 0) {
    return {
      columns,
      rows,
      normalizationMode: "identity",
    }
  }

  const inferred = inferBlendSemanticMapping(rows, columns)
  const entityColumn = isMappingColumnValue(mappingOverride?.entityColumn ?? "", columns)
    ? (mappingOverride?.entityColumn as string)
    : inferred.entityColumn
  const metricColumn = isMappingColumnValue(mappingOverride?.metricColumn ?? "", columns)
    ? (mappingOverride?.metricColumn as string)
    : inferred.metricColumn
  const timeColumn = isMappingColumnValue(mappingOverride?.timeColumn ?? "", columns)
    ? (mappingOverride?.timeColumn as string)
    : inferred.timeColumn
  const valueColumn = isMappingColumnValue(mappingOverride?.valueColumn ?? "", columns)
    ? (mappingOverride?.valueColumn as string)
    : inferred.valueColumn

  const explicitWide =
    timeColumn === BLEND_MAPPING_HEADER_TIME_KEY ||
    valueColumn === BLEND_MAPPING_HEADER_VALUE_KEY
  const shouldWideToLong = explicitWide || inferred.mode === "wide-to-long"

  if (shouldWideToLong) {
    const excludedForPeriod = new Set<string>([entityColumn, metricColumn].filter(Boolean))
    if (columns.includes(valueColumn)) excludedForPeriod.add(valueColumn)
    const periodColumns = resolveEffectivePeriodColumns(rows, columns, excludedForPeriod)
    const nonPeriodColumns = columns.filter((column) => !periodColumns.includes(column))
    const explodedRows: AdapterRow[] = []

    rows.forEach((row, rowIndex) => {
      const baseEntityValue =
        (entityColumn ? toJoinKey(row[entityColumn]) : "") ||
        (metricColumn ? toJoinKey(row[metricColumn]) : "") ||
        `row-${rowIndex + 1}`
      const metricValue =
        (metricColumn ? toJoinKey(row[metricColumn]) : "") ||
        (entityColumn ? toJoinKey(row[entityColumn]) : "") ||
        "value"

      periodColumns.forEach((periodColumn) => {
        const numericValue = toNumericValue(row[periodColumn])
        if (numericValue == null) return
        const nextRow: AdapterRow = {}
        nonPeriodColumns.forEach((column) => {
          nextRow[column] = row[column] ?? null
        })
        nextRow[NORMALIZED_ENTITY_KEY] = baseEntityValue
        nextRow[NORMALIZED_TIME_KEY] = periodColumn
        nextRow[NORMALIZED_METRIC_KEY] = metricValue
        nextRow[NORMALIZED_VALUE_KEY] = numericValue
        explodedRows.push(nextRow)
      })
    })

    return {
      columns: uniqueColumns([...nonPeriodColumns, NORMALIZED_ENTITY_KEY, NORMALIZED_TIME_KEY, NORMALIZED_METRIC_KEY, NORMALIZED_VALUE_KEY]),
      rows: explodedRows,
      normalizationMode: "wide-to-long",
    }
  }

  const canonicalRows = rows.map((row, rowIndex) => {
    const baseEntityValue =
      (entityColumn ? toJoinKey(row[entityColumn]) : "") ||
      (metricColumn ? toJoinKey(row[metricColumn]) : "") ||
      `row-${rowIndex + 1}`
    const metricValue =
      (metricColumn ? toJoinKey(row[metricColumn]) : "") ||
      (columns.includes(valueColumn) ? valueColumn : "value")
    const timeValue = columns.includes(timeColumn) ? toJoinKey(row[timeColumn]) : ""
    const numericValue = columns.includes(valueColumn) ? toNumericValue(row[valueColumn]) : null
    return {
      ...row,
      [NORMALIZED_ENTITY_KEY]: baseEntityValue,
      [NORMALIZED_TIME_KEY]: timeValue,
      [NORMALIZED_METRIC_KEY]: metricValue,
      [NORMALIZED_VALUE_KEY]: numericValue,
    }
  })

  return {
    columns: uniqueColumns([...columns, NORMALIZED_ENTITY_KEY, NORMALIZED_TIME_KEY, NORMALIZED_METRIC_KEY, NORMALIZED_VALUE_KEY]),
    rows: canonicalRows,
    normalizationMode: "row-canonical",
  }
}

function toOhlcPoint(row: AdapterRow): OHLCPoint | null {
  const x = toTimestampValue(row.ts_date)
  const open = toNumericValue(row.open)
  const high = toNumericValue(row.high)
  const low = toNumericValue(row.low)
  const close = toNumericValue(row.close)
  if (x == null || open == null || high == null || low == null || close == null) {
    return null
  }
  return {
    x,
    open,
    high,
    low,
    close,
    volume: toNumericValue(row.volume),
    turnover: toNumericValue(row.turnover),
  }
}

export function isOhlcLikeSource(
  columns: string[],
  rows: AdapterRow[],
  requiredColumns: readonly string[] = DEFAULT_OHLC_REQUIRED_COLUMNS
): boolean {
  const columnSet = new Set(columns)
  if (!requiredColumns.every((column) => columnSet.has(column))) return false
  return rows.some((row) => Boolean(toOhlcPoint(row)))
}

export function buildOhlcSeriesFromRows(
  rows: AdapterRow[],
  name: string,
  id: string
): { id: string; name: string; data: OHLCPoint[] } | null {
  const points = rows
    .map((row) => toOhlcPoint(row))
    .filter((point): point is OHLCPoint => point !== null)
    .sort((a, b) => a.x - b.x)
  if (points.length === 0) return null
  return {
    id,
    name,
    data: points,
  }
}

export function buildOhlcChartData(
  seriesList: Array<{ id: string; name: string; data: OHLCPoint[] }>
): ChartData | null {
  const normalized = seriesList.filter((series) => series.data.length > 0)
  if (normalized.length === 0) return null
  return {
    xAxisType: "datetime",
    series: normalized,
  }
}

export function joinRows(
  leftRows: AdapterRow[],
  rightRows: AdapterRow[],
  leftColumns: string[],
  rightColumns: string[],
  joinKey: string,
  joinType: JoinType
): AdapterRow[] {
  const rightMap = new Map<string, AdapterRow[]>()
  rightRows.forEach((row) => {
    const key = toJoinKey(row[joinKey])
    if (!rightMap.has(key)) rightMap.set(key, [])
    rightMap.get(key)!.push(row)
  })

  const usedRightRows = new Set<number>()
  const rightIndexMap = new Map<AdapterRow, number>()
  rightRows.forEach((row, index) => {
    rightIndexMap.set(row, index)
  })

  const composeRow = (
    leftRow: AdapterRow | null,
    rightRow: AdapterRow | null
  ): AdapterRow => {
    const merged: AdapterRow = {
      [joinKey]: leftRow?.[joinKey] ?? rightRow?.[joinKey] ?? null,
    }
    leftColumns.forEach((column) => {
      if (column === joinKey) return
      merged[`A.${column}`] = leftRow?.[column] ?? null
    })
    rightColumns.forEach((column) => {
      if (column === joinKey) return
      merged[`B.${column}`] = rightRow?.[column] ?? null
    })
    return merged
  }

  const result: AdapterRow[] = []

  if (joinType === "left" || joinType === "inner" || joinType === "full") {
    leftRows.forEach((leftRow) => {
      const key = toJoinKey(leftRow[joinKey])
      const matches = rightMap.get(key) ?? []
      if (matches.length === 0) {
        if (joinType === "left" || joinType === "full") {
          result.push(composeRow(leftRow, null))
        }
        return
      }
      matches.forEach((rightRow) => {
        const rightIndex = rightIndexMap.get(rightRow)
        if (rightIndex != null) usedRightRows.add(rightIndex)
        result.push(composeRow(leftRow, rightRow))
      })
    })
  }

  if (joinType === "right") {
    const leftMap = new Map<string, AdapterRow[]>()
    leftRows.forEach((row) => {
      const key = toJoinKey(row[joinKey])
      if (!leftMap.has(key)) leftMap.set(key, [])
      leftMap.get(key)!.push(row)
    })
    rightRows.forEach((rightRow) => {
      const key = toJoinKey(rightRow[joinKey])
      const matches = leftMap.get(key) ?? []
      if (matches.length === 0) {
        result.push(composeRow(null, rightRow))
        return
      }
      matches.forEach((leftRow) => {
        result.push(composeRow(leftRow, rightRow))
      })
    })
  }

  if (joinType === "full") {
    rightRows.forEach((rightRow, index) => {
      if (usedRightRows.has(index)) return
      result.push(composeRow(null, rightRow))
    })
  }

  return result
}

export function appendRows(
  leftRows: AdapterRow[],
  rightRows: AdapterRow[],
  leftColumns: string[],
  rightColumns: string[]
): { columns: string[]; rows: AdapterRow[] } {
  const columns = uniqueColumns([...leftColumns, ...rightColumns])
  const normalizeRow = (row: AdapterRow): AdapterRow => {
    const normalized: AdapterRow = {}
    columns.forEach((column) => {
      normalized[column] = row[column] ?? null
    })
    return normalized
  }

  return {
    columns,
    rows: [...leftRows.map(normalizeRow), ...rightRows.map(normalizeRow)],
  }
}

export function buildJoinPreview(
  leftRows: AdapterRow[],
  rightRows: AdapterRow[],
  joinKey: string,
  joinType: JoinType,
  outputRows: number
): JoinPreview {
  const leftKeySet = new Set(
    leftRows
      .map((row) => toJoinKey(row[joinKey]))
      .filter((key) => key.length > 0)
  )
  const rightKeySet = new Set(
    rightRows
      .map((row) => toJoinKey(row[joinKey]))
      .filter((key) => key.length > 0)
  )

  const matchedRowsA = leftRows.reduce((count, row) => {
    const key = toJoinKey(row[joinKey])
    if (!key) return count
    return count + (rightKeySet.has(key) ? 1 : 0)
  }, 0)

  const matchedRowsB = rightRows.reduce((count, row) => {
    const key = toJoinKey(row[joinKey])
    if (!key) return count
    return count + (leftKeySet.has(key) ? 1 : 0)
  }, 0)

  const sourceRowsA = leftRows.length
  const sourceRowsB = rightRows.length

  return {
    joinType,
    joinKey,
    outputRows,
    sourceRowsA,
    sourceRowsB,
    matchedRowsA,
    matchedRowsB,
    matchRateA: sourceRowsA > 0 ? matchedRowsA / sourceRowsA : 0,
    matchRateB: sourceRowsB > 0 ? matchedRowsB / sourceRowsB : 0,
  }
}

export function buildChartDataFromRows(
  rows: AdapterRow[],
  xKey: string,
  yKeys: string[]
): ChartData | null {
  if (rows.length === 0) return null
  if (yKeys.length === 0) return null

  const selectedFields = Array.from(new Set(yKeys.filter((field) => field && field !== xKey)))
  if (selectedFields.length === 0) return null

  if (xKey === HEADER_ROW_X_KEY) {
    const columns = Object.keys(rows[0] ?? {})
    const candidateLabelKeys = columns.filter((column) => !selectedFields.includes(column))
    const labelKey = (() => {
      if (candidateLabelKeys.length === 0) return ""
      let best = candidateLabelKeys[0]!
      let bestDistinctCount = -1
      candidateLabelKeys.forEach((column) => {
        const distinctValues = new Set(
          rows
            .map((row) => toJoinKey(row[column]))
            .filter((value) => value.length > 0)
        )
        if (distinctValues.size > bestDistinctCount) {
          bestDistinctCount = distinctValues.size
          best = column
        }
      })
      return best
    })()

    const usedNames = new Map<string, number>()
    const series = rows.map((row, rowIndex) => {
      const base = labelKey ? (toJoinKey(row[labelKey]) || `row-${rowIndex + 1}`) : `row-${rowIndex + 1}`
      const duplicateCount = usedNames.get(base) ?? 0
      usedNames.set(base, duplicateCount + 1)
      const displayName = duplicateCount === 0 ? base : `${base} (${duplicateCount + 1})`
      const id = `${base}-${rowIndex + 1}`

      return {
        id,
        name: displayName,
        data: selectedFields.map((field) => {
          const y = toNumericValue(row[field]) ?? 0
          return { x: field, y }
        }),
      }
    })

    if (series.length === 0) return null
    return {
      xAxisType: "category",
      series,
    }
  }

  const isDateHeader = (value: string): boolean => {
    return isPeriodLikeColumnName(value)
  }

  const toDateHeaderTimestamp = (value: string): number | null => {
    const normalized = value.trim()
    const quarterLike = normalized.match(/^(\d{4})\s*[-/.]?\s*Q([1-4])$/i)
    if (quarterLike) {
      const [, year, quarter] = quarterLike
      const month = String((Number(quarter) - 1) * 3 + 1).padStart(2, "0")
      const parsed = new Date(`${year}-${month}-01T00:00:00`).getTime()
      return Number.isFinite(parsed) ? parsed : null
    }
    const monthLike = normalized.match(/^(\d{4})[./-](0?[1-9]|1[0-2])$/)
    if (monthLike) {
      const [, year, month] = monthLike
      const parsed = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`).getTime()
      return Number.isFinite(parsed) ? parsed : null
    }
    const dayLike = normalized.match(/^(\d{4})[./-](0?[1-9]|1[0-2])[./-](0?[1-9]|[12][0-9]|3[01])$/)
    if (dayLike) {
      const [, year, month, day] = dayLike
      const parsed = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`).getTime()
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  const isWideDateHeaderMode = selectedFields.length >= 2 && selectedFields.every((field) => isDateHeader(field))
  if (isWideDateHeaderMode) {
    const sortedDateFields = [...selectedFields].sort((a, b) => {
      const left = toDateHeaderTimestamp(a)
      const right = toDateHeaderTimestamp(b)
      if (left != null && right != null) return left - right
      return a.localeCompare(b)
    })

    const usedNames = new Map<string, number>()
    const series = rows.map((row, rowIndex) => {
      const base = toJoinKey(row[xKey]) || `row-${rowIndex + 1}`
      const duplicateCount = usedNames.get(base) ?? 0
      usedNames.set(base, duplicateCount + 1)
      const displayName = duplicateCount === 0 ? base : `${base} (${duplicateCount + 1})`
      const id = `${base}-${rowIndex + 1}`

      return {
        id,
        name: displayName,
        data: sortedDateFields.map((field) => {
          const rawValue = row[field]
          const y = toNumericValue(rawValue) ?? 0
          return { x: field, y }
        }),
      }
    })

    if (series.length === 0) return null
    return {
      xAxisType: "category",
      series,
    }
  }

  return {
    xAxisType: "category",
    series: selectedFields.map((field) => ({
      id: field,
      name: field,
      data: rows.map((row, index) => {
        const xLabel = toJoinKey(row[xKey]) || `row-${index + 1}`
        const y = toNumericValue(row[field]) ?? 0
        return { x: xLabel, y }
      }),
    })),
  }
}
