import { useCallback, useState } from "react"
import type { PageHDbMetricKey } from "./page-h-db"
import type { DerivedFormulaId, PageHDerivedState } from "./page-h-derived-types"

type UsePageHDerivedStateResult = {
  state: PageHDerivedState
  setFormulaId: (formulaId: DerivedFormulaId) => void
  setPrimaryMetricKey: (metricKey: PageHDbMetricKey) => void
  setSecondaryMetricKey: (metricKey: PageHDbMetricKey) => void
  setCustomName: (value: string) => void
  reset: () => void
  pruneUnavailableMetrics: (availableMetricKeys: PageHDbMetricKey[]) => void
}

const DEFAULT_STATE: PageHDerivedState = {
  formulaId: "ratio_percent",
  primaryMetricKey: "",
  secondaryMetricKey: "",
  customName: "",
}

export function usePageHDerivedState(): UsePageHDerivedStateResult {
  const [state, setState] = useState<PageHDerivedState>(DEFAULT_STATE)

  const setFormulaId = useCallback((formulaId: DerivedFormulaId) => {
    setState((prev) => ({
      ...prev,
      formulaId,
    }))
  }, [])

  const setPrimaryMetricKey = useCallback((metricKey: PageHDbMetricKey) => {
    setState((prev) => ({
      ...prev,
      primaryMetricKey: metricKey,
    }))
  }, [])

  const setSecondaryMetricKey = useCallback((metricKey: PageHDbMetricKey) => {
    setState((prev) => ({
      ...prev,
      secondaryMetricKey: metricKey,
    }))
  }, [])

  const setCustomName = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      customName: value,
    }))
  }, [])

  const reset = useCallback(() => {
    setState(DEFAULT_STATE)
  }, [])

  const pruneUnavailableMetrics = useCallback((availableMetricKeys: PageHDbMetricKey[]) => {
    const available = new Set(availableMetricKeys)
    setState((prev) => ({
      ...prev,
      primaryMetricKey: available.has(prev.primaryMetricKey) ? prev.primaryMetricKey : "",
      secondaryMetricKey: available.has(prev.secondaryMetricKey) ? prev.secondaryMetricKey : "",
    }))
  }, [])

  return {
    state,
    setFormulaId,
    setPrimaryMetricKey,
    setSecondaryMetricKey,
    setCustomName,
    reset,
    pruneUnavailableMetrics,
  }
}

