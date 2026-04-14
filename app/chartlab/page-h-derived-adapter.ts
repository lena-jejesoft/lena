import type { MetricValueRow } from "./query"
import type {
  DerivedFormulaId,
  DerivedFormulaPreset,
  DerivedMetricSeries,
  DerivedMetricSource,
} from "./page-h-derived-types"

type ComputeDerivedMetricParams = {
  formulaId: DerivedFormulaId
  primaryMetric: DerivedMetricSource
  secondaryMetric?: DerivedMetricSource | null
  customName?: string
}

const MAX_DECIMALS = 6

export const DERIVED_FORMULA_PRESETS: DerivedFormulaPreset[] = [
  {
    id: "sum",
    label: "A + B",
    description: "두 지표를 더한 값을 계산합니다.",
    inputCount: 2,
  },
  {
    id: "difference",
    label: "A - B",
    description: "두 지표의 차이를 계산합니다.",
    inputCount: 2,
  },
  {
    id: "ratio_percent",
    label: "(A / B) * 100",
    description: "두 지표의 비율(%)을 계산합니다.",
    inputCount: 2,
    unitSuffix: "%",
  },
  {
    id: "period_change_percent",
    label: "전기 대비 증감률(%)",
    description: "단일 지표의 연속 시점 대비 증감률(%)을 계산합니다.",
    inputCount: 1,
    unitSuffix: "%",
  },
]

const FORMULA_LABELS: Record<DerivedFormulaId, string> = {
  sum: "합계",
  difference: "차이",
  ratio_percent: "비율",
  period_change_percent: "전기 대비 증감률",
}

function roundValue(value: number): number {
  return Number(value.toFixed(MAX_DECIMALS))
}

function sortRows(rows: MetricValueRow[]): MetricValueRow[] {
  return [...rows].sort((a, b) => a.ts_date.localeCompare(b.ts_date))
}

function toValueMap(rows: MetricValueRow[]): Map<string, number> {
  const map = new Map<string, number>()
  rows.forEach((row) => {
    if (!Number.isFinite(row.value)) return
    map.set(row.ts_date, row.value)
  })
  return map
}

function buildMetricKey(formulaId: DerivedFormulaId, primaryMetricKey: string, secondaryMetricKey?: string): string {
  return secondaryMetricKey
    ? `derived:${formulaId}:${primaryMetricKey}:${secondaryMetricKey}`
    : `derived:${formulaId}:${primaryMetricKey}`
}

function resolveDefaultName(formulaId: DerivedFormulaId, primaryLabel: string, secondaryLabel?: string): string {
  if (formulaId === "period_change_percent") {
    return `${primaryLabel} 전기 대비 증감률(%)`
  }
  if (formulaId === "ratio_percent") {
    return `${primaryLabel}/${secondaryLabel ?? "B"} 비율(%)`
  }
  if (formulaId === "sum") {
    return `${primaryLabel} + ${secondaryLabel ?? "B"}`
  }
  return `${primaryLabel} - ${secondaryLabel ?? "B"}`
}

function resolveDerivedUnit(
  formulaId: DerivedFormulaId,
  primaryUnit?: string,
  secondaryUnit?: string
): string | undefined {
  if (formulaId === "ratio_percent" || formulaId === "period_change_percent") {
    return "%"
  }

  const leftUnit = String(primaryUnit ?? "").trim()
  const rightUnit = String(secondaryUnit ?? "").trim()
  if (!leftUnit) return undefined
  if (formulaId === "sum" || formulaId === "difference") {
    return leftUnit === rightUnit ? leftUnit : undefined
  }
  return undefined
}

function computeBinaryRows(
  formulaId: Exclude<DerivedFormulaId, "period_change_percent">,
  primaryRows: MetricValueRow[],
  secondaryRows: MetricValueRow[]
): MetricValueRow[] {
  const primaryMap = toValueMap(primaryRows)
  const secondaryMap = toValueMap(secondaryRows)
  const dates = Array.from(primaryMap.keys())
    .filter((date) => secondaryMap.has(date))
    .sort((a, b) => a.localeCompare(b))

  const result: MetricValueRow[] = []
  dates.forEach((tsDate) => {
    const leftValue = primaryMap.get(tsDate)
    const rightValue = secondaryMap.get(tsDate)
    if (typeof leftValue !== "number" || typeof rightValue !== "number") return
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return

    if (formulaId === "sum") {
      result.push({ ts_date: tsDate, value: roundValue(leftValue + rightValue) })
      return
    }
    if (formulaId === "difference") {
      result.push({ ts_date: tsDate, value: roundValue(leftValue - rightValue) })
      return
    }
    if (rightValue === 0) return
    result.push({ ts_date: tsDate, value: roundValue((leftValue / rightValue) * 100) })
  })

  return result
}

function computePeriodChangeRows(primaryRows: MetricValueRow[]): MetricValueRow[] {
  const sorted = sortRows(primaryRows).filter((row) => Number.isFinite(row.value))
  const result: MetricValueRow[] = []

  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]
    const current = sorted[index]
    if (!prev || !current) continue
    if (prev.value === 0) continue
    const value = ((current.value - prev.value) / prev.value) * 100
    if (!Number.isFinite(value)) continue
    result.push({
      ts_date: current.ts_date,
      value: roundValue(value),
    })
  }

  return result
}

export function getDerivedFormulaPreset(formulaId: DerivedFormulaId): DerivedFormulaPreset {
  return DERIVED_FORMULA_PRESETS.find((preset) => preset.id === formulaId) ?? DERIVED_FORMULA_PRESETS[0]!
}

export function computeDerivedMetricSeries(params: ComputeDerivedMetricParams): DerivedMetricSeries {
  const preset = getDerivedFormulaPreset(params.formulaId)
  const primary = params.primaryMetric
  const secondary = params.secondaryMetric ?? null
  const normalizedName = String(params.customName ?? "").trim()

  let rows: MetricValueRow[] = []
  let dependencies: string[] = [primary.metricKey]
  let metricKey = buildMetricKey(params.formulaId, primary.metricKey)

  if (preset.inputCount === 1) {
    rows = computePeriodChangeRows(primary.rows)
  } else {
    if (!secondary) {
      throw new Error("2개 지표가 필요한 계산식입니다. 보조 지표를 선택해 주세요.")
    }
    if (params.formulaId === "period_change_percent") {
      throw new Error("현재 계산식 설정이 올바르지 않습니다. 계산식을 다시 선택해 주세요.")
    }
    dependencies = [primary.metricKey, secondary.metricKey]
    metricKey = buildMetricKey(params.formulaId, primary.metricKey, secondary.metricKey)
    rows = computeBinaryRows(params.formulaId, primary.rows, secondary.rows)
  }

  const seriesName = normalizedName || resolveDefaultName(params.formulaId, primary.label, secondary?.label)
  const unit = resolveDerivedUnit(params.formulaId, primary.unit, secondary?.unit)

  return {
    metricKey,
    seriesName,
    unit,
    rows,
    meta: {
      kind: "derived",
      formulaId: params.formulaId,
      dependencies,
    },
  }
}

export function formatDerivedBlendMessage(seriesName: string, rowCount: number): string {
  return `${seriesName} 파생 지표를 계산해 ${rowCount}개 포인트를 차트에 반영했습니다.`
}

export function getDerivedFormulaLabel(formulaId: DerivedFormulaId): string {
  return FORMULA_LABELS[formulaId] ?? formulaId
}
