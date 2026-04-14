import { useCallback, useMemo, useState } from "react"
import type { PageHDbDimensionKey, PageHDbMetricKey } from "./page-h-db"
import type { ResolvedSeries } from "./series-addition-types"

type UseSeriesAdditionStateResult = {
  companyId: string
  companyName: string | null
  metricSearchTerm: string
  dimensionKey: PageHDbDimensionKey
  checkedMetricKeys: PageHDbMetricKey[]
  checkedMetricKeySet: Set<PageHDbMetricKey>
  resolvedSeriesMap: Map<PageHDbMetricKey, ResolvedSeries>
  fetchingMetricKeys: Set<PageHDbMetricKey>
  setCompanyId: (companyId: string) => void
  setCompanyName: (name: string | null) => void
  setMetricSearchTerm: (value: string) => void
  setDimensionKey: (value: PageHDbDimensionKey) => void
  toggleMetric: (metricKey: PageHDbMetricKey) => void
  markFetching: (metricKey: PageHDbMetricKey) => void
  markFetched: (metricKey: PageHDbMetricKey, series: ResolvedSeries) => void
  markFetchFailed: (metricKey: PageHDbMetricKey) => void
  clearAll: () => void
}

export function useSeriesAdditionState(): UseSeriesAdditionStateResult {
  const [companyId, _setCompanyId] = useState("")
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [metricSearchTerm, setMetricSearchTerm] = useState("")
  const [dimensionKey, setDimensionKey] = useState<PageHDbDimensionKey>("auto")
  const [checkedMetricKeys, setCheckedMetricKeys] = useState<PageHDbMetricKey[]>([])
  const [resolvedSeriesMap, setResolvedSeriesMap] = useState<Map<PageHDbMetricKey, ResolvedSeries>>(new Map())
  const [fetchingMetricKeys, setFetchingMetricKeys] = useState<Set<PageHDbMetricKey>>(new Set())

  const checkedMetricKeySet = useMemo(() => new Set(checkedMetricKeys), [checkedMetricKeys])

  const setCompanyId = useCallback(
    (nextCompanyId: string) => {
      _setCompanyId((prev) => {
        if (prev === nextCompanyId) return prev
        // 회사가 바뀌어도 기존 선택된 시리즈는 유지 (차트에 계속 표시)
        setFetchingMetricKeys(new Set())
        return nextCompanyId
      })
    },
    []
  )

  const toggleMetric = useCallback((metricKey: PageHDbMetricKey) => {
    if (!metricKey) return
    setCheckedMetricKeys((prev) => {
      if (prev.includes(metricKey)) {
        // 해제: resolvedSeriesMap에서도 제거
        setResolvedSeriesMap((m) => {
          const next = new Map(m)
          next.delete(metricKey)
          return next
        })
        return prev.filter((k) => k !== metricKey)
      }
      return [...prev, metricKey]
    })
  }, [])

  const markFetching = useCallback((metricKey: PageHDbMetricKey) => {
    setFetchingMetricKeys((prev) => new Set([...prev, metricKey]))
  }, [])

  const markFetched = useCallback((metricKey: PageHDbMetricKey, series: ResolvedSeries) => {
    setFetchingMetricKeys((prev) => {
      const next = new Set(prev)
      next.delete(metricKey)
      return next
    })
    setResolvedSeriesMap((prev) => new Map([...prev, [metricKey, series]]))
  }, [])

  const markFetchFailed = useCallback((metricKey: PageHDbMetricKey) => {
    setFetchingMetricKeys((prev) => {
      const next = new Set(prev)
      next.delete(metricKey)
      return next
    })
    // 실패 시 체크 해제
    setCheckedMetricKeys((prev) => prev.filter((k) => k !== metricKey))
  }, [])

  const clearAll = useCallback(() => {
    setCheckedMetricKeys([])
    setResolvedSeriesMap(new Map())
    setFetchingMetricKeys(new Set())
  }, [])

  return {
    companyId,
    companyName,
    metricSearchTerm,
    dimensionKey,
    checkedMetricKeys,
    checkedMetricKeySet,
    resolvedSeriesMap,
    fetchingMetricKeys,
    setCompanyId,
    setCompanyName,
    setMetricSearchTerm,
    setDimensionKey,
    toggleMetric,
    markFetching,
    markFetched,
    markFetchFailed,
    clearAll,
  }
}
