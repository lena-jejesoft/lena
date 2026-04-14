import { useCallback, useMemo, useState } from "react"
import type { PageHDbDimensionKey, PageHDbMetricKey } from "./page-h-db"
import type { PageHHierarchyState } from "./page-h-hierarchy-types"

type UsePageHHierarchyStateResult = {
  state: PageHHierarchyState
  selectedMetricKeySet: Set<PageHDbMetricKey>
  setCompanyId: (companyId: string) => void
  setCompanySearchTerm: (value: string) => void
  setMetricSearchTerm: (value: string) => void
  setDimensionKey: (value: PageHDbDimensionKey) => void
  toggleMetricSelection: (metricKey: PageHDbMetricKey) => void
  removeMetricSelection: (metricKey: PageHDbMetricKey) => void
  clearMetricSelections: () => void
  pruneUnavailableMetrics: (availableMetricKeys: PageHDbMetricKey[]) => void
}

const DEFAULT_STATE: PageHHierarchyState = {
  companyId: "",
  companySearchTerm: "",
  metricSearchTerm: "",
  dimensionKey: "auto",
  selectedMetricKeys: [],
}

export function usePageHHierarchyState(): UsePageHHierarchyStateResult {
  const [state, setState] = useState<PageHHierarchyState>(DEFAULT_STATE)

  const selectedMetricKeySet = useMemo(() => new Set(state.selectedMetricKeys), [state.selectedMetricKeys])

  const setCompanyId = useCallback((companyId: string) => {
    // 회사가 바뀌면 이전 metric 선택은 제거해 잘못된 조합 반영을 막는다.
    setState((prev) => {
      if (prev.companyId === companyId) return prev
      return {
        ...prev,
        companyId,
        selectedMetricKeys: [],
      }
    })
  }, [])

  const setCompanySearchTerm = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      companySearchTerm: value,
    }))
  }, [])

  const setMetricSearchTerm = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      metricSearchTerm: value,
    }))
  }, [])

  const setDimensionKey = useCallback((value: PageHDbDimensionKey) => {
    setState((prev) => ({
      ...prev,
      dimensionKey: value,
    }))
  }, [])

  const toggleMetricSelection = useCallback((metricKey: PageHDbMetricKey) => {
    if (!metricKey) return
    setState((prev) => {
      const exists = prev.selectedMetricKeys.includes(metricKey)
      return {
        ...prev,
        selectedMetricKeys: exists
          ? prev.selectedMetricKeys.filter((key) => key !== metricKey)
          : [...prev.selectedMetricKeys, metricKey],
      }
    })
  }, [])

  const removeMetricSelection = useCallback((metricKey: PageHDbMetricKey) => {
    if (!metricKey) return
    setState((prev) => {
      if (!prev.selectedMetricKeys.includes(metricKey)) return prev
      return {
        ...prev,
        selectedMetricKeys: prev.selectedMetricKeys.filter((key) => key !== metricKey),
      }
    })
  }, [])

  const clearMetricSelections = useCallback(() => {
    setState((prev) => {
      if (prev.selectedMetricKeys.length === 0) return prev
      return {
        ...prev,
        selectedMetricKeys: [],
      }
    })
  }, [])

  const pruneUnavailableMetrics = useCallback((availableMetricKeys: PageHDbMetricKey[]) => {
    const allowed = new Set(availableMetricKeys)
    setState((prev) => {
      const next = prev.selectedMetricKeys.filter((metricKey) => allowed.has(metricKey))
      if (next.length === prev.selectedMetricKeys.length) return prev
      return {
        ...prev,
        selectedMetricKeys: next,
      }
    })
  }, [])

  return {
    state,
    selectedMetricKeySet,
    setCompanyId,
    setCompanySearchTerm,
    setMetricSearchTerm,
    setDimensionKey,
    toggleMetricSelection,
    removeMetricSelection,
    clearMetricSelections,
    pruneUnavailableMetrics,
  }
}
