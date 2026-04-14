import type { MetricValueRow } from "./query"

export type DerivedFormulaId =
  | "sum"
  | "difference"
  | "ratio_percent"
  | "period_change_percent"

export type DerivedFormulaPreset = {
  id: DerivedFormulaId
  label: string
  description: string
  inputCount: 1 | 2
  unitSuffix?: string
}

export type DerivedMetricMeta = {
  kind: "derived"
  formulaId: DerivedFormulaId
  dependencies: string[]
}

export type DerivedMetricSeries = {
  metricKey: string
  seriesName: string
  unit?: string
  rows: MetricValueRow[]
  meta: DerivedMetricMeta
}

export type DerivedMetricSource = {
  metricKey: string
  label: string
  unit?: string
  rows: MetricValueRow[]
}

export type PageHDerivedState = {
  formulaId: DerivedFormulaId
  primaryMetricKey: string
  secondaryMetricKey: string
  customName: string
}
