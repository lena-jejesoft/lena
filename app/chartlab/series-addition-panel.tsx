"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import {
  fetchCompanyMetricCatalog,
  fetchCompanyMetricRows,
  type CompanyMetricCatalogItem,
} from "./query"
import {
  fetchMockSectorbookCompanies,
  fetchMockSectorbookMetricCatalog,
  fetchMockSectorbookMetricRows,
  type MockSectorbookCompany,
} from "./mock-sectorbook-provider"
import { useSeriesAdditionState } from "./series-addition-state"
import {
  buildUnifiedSourceGroups,
  buildChartDataFromResolvedSeries,
  extractUploadColumnAsRows,
  flattenMetricNodes,
} from "./series-addition-adapter"
import type {
  SeriesAdditionPanelProps,
  SeriesTreeCategory,
  SeriesTreeGroup,
  SeriesTreeSourceGroup,
  UnifiedMetricNode,
} from "./series-addition-types"
import type { PageHDbDimensionKey, PageHDbCompanyOption } from "./page-h-db"
import { PageHDerivedPanel } from "./page-h-derived-panel"
import {
  computeDerivedMetricSeries,
  DERIVED_FORMULA_PRESETS,
  getDerivedFormulaPreset,
} from "./page-h-derived-adapter"
import { usePageHDerivedState } from "./page-h-derived-state"
import type { DerivedFormulaId } from "./page-h-derived-types"

const USE_MOCK = false

const DIMENSION_OPTIONS: Array<{ value: PageHDbDimensionKey; label: string }> = [
  { value: "auto", label: "자동" },
  { value: "daily", label: "일간" },
  { value: "monthly", label: "월간" },
  { value: "quarterly", label: "분기" },
  { value: "yearly", label: "연간" },
]

// --- 트리 렌더 하위 컴포넌트 ---

function getGroupMetricCount(group: SeriesTreeGroup): number {
  return group.metrics.length + group.children.reduce((acc, child) => acc + getGroupMetricCount(child), 0)
}

type MetricCheckboxProps = {
  node: UnifiedMetricNode
  checked: boolean
  fetching: boolean
  onToggle: (metricKey: string) => void
}

function MetricCheckbox({ node, checked, fetching, onToggle }: MetricCheckboxProps) {
  return (
    <label
      className="flex cursor-pointer items-center gap-1.5 px-1 py-px text-[11px] text-[#ccc] hover:bg-[#333]/60 hover:text-white [&_input]:accent-primary"
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={fetching}
        onChange={() => onToggle(node.metricKey)}
        className="h-3 w-3"
      />
      <span className="truncate">{node.label}</span>
      {fetching && <span className="text-[#888]">(로딩...)</span>}
    </label>
  )
}

type TreeGroupProps = {
  groups: SeriesTreeGroup[]
  checkedKeys: Set<string>
  fetchingKeys: Set<string>
  onToggle: (metricKey: string) => void
  depth?: number
}

function TreeGroupList({ groups, checkedKeys, fetchingKeys, onToggle, depth = 0 }: TreeGroupProps) {
  if (groups.length === 0) return null
  return (
    <div className={depth > 0 ? "space-y-0.5 pl-3" : "space-y-0.5"}>
      {groups.map((group) => {
        const count = getGroupMetricCount(group)
        return (
          <details key={group.id} open className="hierarchy-tree group/tree">
            <summary className="cursor-pointer text-[11px] font-medium text-[#ccc] flex items-center gap-1 py-0.5 hover:text-white">
              <span className="text-[9px] text-[#666] inline-block transition-transform duration-150 group-open/tree:rotate-90">›</span>
              {group.label} ({count})
            </summary>
            <div className="mt-0.5 space-y-0.5 pl-2">
              {group.metrics.map((metric) => (
                <MetricCheckbox
                  key={metric.metricKey}
                  node={metric}
                  checked={checkedKeys.has(metric.metricKey)}
                  fetching={fetchingKeys.has(metric.metricKey)}
                  onToggle={onToggle}
                />
              ))}
              <TreeGroupList
                groups={group.children}
                checkedKeys={checkedKeys}
                fetchingKeys={fetchingKeys}
                onToggle={onToggle}
                depth={depth + 1}
              />
            </div>
          </details>
        )
      })}
    </div>
  )
}

type CategoryTreeProps = {
  categories: SeriesTreeCategory[]
  checkedKeys: Set<string>
  fetchingKeys: Set<string>
  onToggle: (metricKey: string) => void
}

function CategoryTree({ categories, checkedKeys, fetchingKeys, onToggle }: CategoryTreeProps) {
  return (
    <>
      {categories.map((category) => {
        const catCount =
          category.metrics.length +
          category.groups.reduce((acc, g) => acc + getGroupMetricCount(g), 0)
        return (
          <details key={category.id} open className="hierarchy-tree group/cat">
            <summary className="cursor-pointer text-[11px] font-medium text-[#ccc] flex items-center gap-1 py-0.5 hover:text-white">
              <span className="text-[9px] text-[#666] inline-block transition-transform duration-150 group-open/cat:rotate-90">›</span>
              {category.label} ({catCount})
            </summary>
            <div className="mt-0.5 space-y-0.5 pl-3">
              {category.metrics.map((metric) => (
                <MetricCheckbox
                  key={metric.metricKey}
                  node={metric}
                  checked={checkedKeys.has(metric.metricKey)}
                  fetching={fetchingKeys.has(metric.metricKey)}
                  onToggle={onToggle}
                />
              ))}
              <TreeGroupList
                groups={category.groups}
                checkedKeys={checkedKeys}
                fetchingKeys={fetchingKeys}
                onToggle={onToggle}
              />
            </div>
          </details>
        )
      })}
    </>
  )
}

// --- 메인 패널 ---

export function SeriesAdditionPanel({
  activeBlock,
  onUpdateBlock,
  onCreateBlock,
  uploadedSources,
  onOpenUploadDialog,
  onDerivedSectionElementChange,
}: SeriesAdditionPanelProps) {
  const supabase = useMemo(() => createClient(), [])
  const state = useSeriesAdditionState()

  // 회사 검색 상태
  const [companySearchTerm, setCompanySearchTerm] = useState("")
  const [companies, setCompanies] = useState<PageHDbCompanyOption[]>([])
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(false)
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const companyDropdownRef = useRef<HTMLDivElement>(null)

  // 메트릭 카탈로그
  const [companyMetrics, setCompanyMetrics] = useState<CompanyMetricCatalogItem[]>([])
  const [isMetricsLoading, setIsMetricsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 파생지표
  const derivedState = usePageHDerivedState()
  const [derivedError, setDerivedError] = useState<string | null>(null)

  // 회사 검색 드롭다운 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 회사 검색 (debounced)
  useEffect(() => {
    if (companySearchTerm.trim().length < 1) {
      setCompanies([])
      return
    }

    const timer = setTimeout(async () => {
      setIsCompaniesLoading(true)
      try {
        if (USE_MOCK) {
          const { items, error: err } = await fetchMockSectorbookCompanies({
            searchKeyword: companySearchTerm.trim(),
            limit: 10,
          })
          if (err) {
            setCompanies([])
            return
          }
          setCompanies(items.map((item) => ({
            id: item.id,
            name: item.name,
            ticker: item.ticker,
            market: item.market,
          })))
        } else {
          const keyword = companySearchTerm.trim()
          const { data, error: err } = await supabase
            .from("entity_item")
            .select("id, name, data, type:entity_type!inner(name)")
            .eq("type.name", "company")
            .eq("metadata->>is_active", "true")
            .ilike("name", `%${keyword}%`)
            .order("name")
            .limit(10)
          if (err) {
            setCompanies([])
            return
          }
          setCompanies(
            (data ?? []).map((item) => {
              const metadata = (item.data as Record<string, unknown> | null) ?? null
              return {
                id: item.id,
                name: item.name,
                ticker: typeof metadata?.ticker === "string" ? metadata.ticker : undefined,
                market: typeof metadata?.market === "string" ? metadata.market : undefined,
              }
            })
          )
        }
        setCompanyDropdownOpen(true)
      } finally {
        setIsCompaniesLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [companySearchTerm, supabase])

  // 회사 선택 핸들러
  const handleSelectCompany = useCallback(
    (company: PageHDbCompanyOption) => {
      setCompanySearchTerm(company.name)
      setCompanyDropdownOpen(false)
      state.setCompanyId(company.id)
      state.setCompanyName(company.name)
    },
    [state]
  )

  // 회사 ID가 바뀌면 메트릭 카탈로그를 로드
  useEffect(() => {
    if (!state.companyId) {
      setCompanyMetrics([])
      return
    }
    let cancelled = false
    setIsMetricsLoading(true)
    setError(null)

    const load = async () => {
      const { items, companyName, error: err } = USE_MOCK
        ? await fetchMockSectorbookMetricCatalog({ companyId: state.companyId })
        : await fetchCompanyMetricCatalog(supabase, { companyId: state.companyId })
      if (cancelled) return
      setIsMetricsLoading(false)
      if (err) {
        setError(err)
        setCompanyMetrics([])
        return
      }
      if (companyName) {
        state.setCompanyName(companyName)
      }
      setCompanyMetrics(items)
    }
    load()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- state.setCompanyName은 안정적인 참조이므로 state 전체를 넣지 않는다
  }, [state.companyId, supabase])

  // 통합 트리 빌드
  const unifiedGroups = useMemo(
    () => buildUnifiedSourceGroups(companyMetrics, state.companyName, state.companyId, uploadedSources, state.metricSearchTerm),
    [companyMetrics, state.companyName, state.companyId, uploadedSources, state.metricSearchTerm]
  )

  // metricKey → node 매핑
  const metricNodeMap = useMemo(() => {
    const nodes = flattenMetricNodes(unifiedGroups)
    const map = new Map<string, UnifiedMetricNode>()
    for (const node of nodes) {
      map.set(node.metricKey, node)
    }
    return map
  }, [unifiedGroups])

  // 메트릭 토글 (즉시 시리즈 추가/제거)
  const handleToggleMetric = useCallback(
    async (metricKey: string) => {
      if (state.checkedMetricKeySet.has(metricKey)) {
        // 해제
        state.toggleMetric(metricKey)
        return
      }

      // 체크: 데이터를 fetch 후 시리즈 추가
      const node = metricNodeMap.get(metricKey)
      if (!node) return

      state.toggleMetric(metricKey)
      state.markFetching(metricKey)

      try {
        let rows: { ts_date: string; value: number }[]

        if (node.origin === "company" && node.metricTypeId && node.entitySource) {
          const response = USE_MOCK
            ? await fetchMockSectorbookMetricRows({
                companyId: state.companyId,
                metricTypeId: node.metricTypeId,
                entitySource: node.entitySource,
                dimension: state.dimensionKey,
              })
            : await fetchCompanyMetricRows(supabase, {
                companyId: state.companyId,
                metricTypeId: node.metricTypeId,
                entitySource: node.entitySource,
                dimension: state.dimensionKey,
              })

          if (response.error) throw new Error(response.error)
          rows = response.rows
        } else if (node.origin === "upload" && node.uploadSlot && node.columnName) {
          const source = uploadedSources[node.uploadSlot]
          if (!source) throw new Error("업로드 데이터를 찾을 수 없습니다.")
          rows = extractUploadColumnAsRows(source, node.columnName)
        } else {
          throw new Error("알 수 없는 metric origin")
        }

        if (rows.length === 0) {
          state.markFetchFailed(metricKey)
          setError(`${node.label}: 데이터가 없습니다.`)
          return
        }

        const seriesLabel =
          node.origin === "company" && state.companyName
            ? `${state.companyName} ${node.label}`
            : node.label

        state.markFetched(metricKey, {
          metricKey,
          label: seriesLabel,
          unit: node.unit,
          origin: node.origin,
          rows,
        })
      } catch (err) {
        state.markFetchFailed(metricKey)
        setError(err instanceof Error ? err.message : "데이터 조회 중 오류가 발생했습니다.")
      }
    },
    [state, metricNodeMap, supabase, uploadedSources]
  )

  // resolvedSeriesMap 또는 checkedMetricKeys가 변하면 차트를 업데이트
  const prevSeriesMapRef = useRef(state.resolvedSeriesMap)
  const prevCheckedKeysRef = useRef(state.checkedMetricKeys)
  useEffect(() => {
    if (prevSeriesMapRef.current === state.resolvedSeriesMap && prevCheckedKeysRef.current === state.checkedMetricKeys) return
    prevSeriesMapRef.current = state.resolvedSeriesMap
    prevCheckedKeysRef.current = state.checkedMetricKeys

    const chartData = buildChartDataFromResolvedSeries(state.checkedMetricKeys, state.resolvedSeriesMap)

    if (!chartData || chartData.series.length === 0) {
      // 시리즈가 모두 해제된 경우에도 차트를 갱신하여 빈 상태로 업데이트
      if (activeBlock) {
        onUpdateBlock({ xAxisType: "category", series: [] }, "지표 비교", "0개 시리즈")
      }
      return
    }

    const title = state.companyName ? `${state.companyName} 지표 비교` : "지표 비교"
    const description = `${chartData.series.length}개 시리즈`

    if (activeBlock) {
      onUpdateBlock(chartData, title, description)
    } else {
      onCreateBlock(chartData, title, description, "chartCore/line")
    }
  }, [state.resolvedSeriesMap, state.checkedMetricKeys, state.companyName, activeBlock, onUpdateBlock, onCreateBlock])

  // 선택된 시리즈 목록 (태그 표시용)
  const selectedSeriesList = useMemo(() => {
    return state.checkedMetricKeys
      .map((key) => {
        const resolved = state.resolvedSeriesMap.get(key)
        const node = metricNodeMap.get(key)
        return {
          metricKey: key,
          label: resolved?.label ?? node?.label ?? key,
          fetching: state.fetchingMetricKeys.has(key),
        }
      })
  }, [state.checkedMetricKeys, state.resolvedSeriesMap, state.fetchingMetricKeys, metricNodeMap])

  // 파생지표용 메트릭 옵션 (resolve 완료된 시리즈만)
  const derivedMetricOptions = useMemo(() => {
    return Array.from(state.resolvedSeriesMap.values()).map((series) => ({
      metricKey: series.metricKey,
      label: series.label,
    }))
  }, [state.resolvedSeriesMap])

  // 파생지표 계산식 프리셋
  const derivedFormulaPreset = useMemo(
    () => getDerivedFormulaPreset(derivedState.state.formulaId),
    [derivedState.state.formulaId]
  )

  // 파생지표 적용
  const handleApplyDerivedMetric = useCallback(async () => {
    const primarySeries = state.resolvedSeriesMap.get(derivedState.state.primaryMetricKey)
    if (!primarySeries) {
      setDerivedError("원본 지표 A를 먼저 선택해 주세요.")
      return
    }

    const secondarySeries =
      derivedFormulaPreset.inputCount === 2
        ? state.resolvedSeriesMap.get(derivedState.state.secondaryMetricKey)
        : null

    if (derivedFormulaPreset.inputCount === 2 && !secondarySeries) {
      setDerivedError("원본 지표 B를 먼저 선택해 주세요.")
      return
    }

    setDerivedError(null)

    try {
      const result = computeDerivedMetricSeries({
        formulaId: derivedState.state.formulaId,
        primaryMetric: {
          metricKey: primarySeries.metricKey,
          label: primarySeries.label,
          unit: primarySeries.unit,
          rows: primarySeries.rows,
        },
        secondaryMetric: secondarySeries
          ? {
              metricKey: secondarySeries.metricKey,
              label: secondarySeries.label,
              unit: secondarySeries.unit,
              rows: secondarySeries.rows,
            }
          : null,
        customName: derivedState.state.customName,
      })

      if (result.rows.length === 0) {
        setDerivedError("계산 결과가 없습니다. 입력 지표의 기간이 겹치는지 확인해 주세요.")
        return
      }

      // 파생지표를 resolvedSeriesMap에 추가 (이미 체크된 경우 toggle하지 않아 oscillation 방지)
      if (!state.checkedMetricKeySet.has(result.metricKey)) {
        state.toggleMetric(result.metricKey)
      }
      state.markFetched(result.metricKey, {
        metricKey: result.metricKey,
        label: result.seriesName,
        unit: result.unit,
        origin: "derived",
        rows: result.rows,
      })
    } catch (err) {
      setDerivedError(err instanceof Error ? err.message : "파생 지표 계산 중 오류가 발생했습니다.")
    }
  }, [state, derivedState.state, derivedFormulaPreset.inputCount])

  // 파생지표 자동 적용 (handleApplyDerivedMetric을 ref로 참조하여 state 변경 → effect 재실행 순환 방지)
  const handleApplyDerivedMetricRef = useRef(handleApplyDerivedMetric)
  handleApplyDerivedMetricRef.current = handleApplyDerivedMetric

  useEffect(() => {
    const { formulaId, primaryMetricKey, secondaryMetricKey } = derivedState.state
    if (!primaryMetricKey) return

    const formulaPreset = getDerivedFormulaPreset(formulaId)
    if (formulaPreset.inputCount === 2 && !secondaryMetricKey) return

    const timer = setTimeout(() => {
      handleApplyDerivedMetricRef.current()
    }, 300)
    return () => clearTimeout(timer)
  }, [
    derivedState.state.formulaId,
    derivedState.state.primaryMetricKey,
    derivedState.state.secondaryMetricKey,
    derivedState.state.customName,
  ])

  const handleDerivedSectionRef = useCallback((node: HTMLElement | null) => {
    onDerivedSectionElementChange?.(node)
  }, [onDerivedSectionElementChange])

  return (
    <div className="space-y-3">
      {/* Feature 1: 데이터 불러오기 */}
      <section className="space-y-2">
        <div>
          <p className="text-[11px] font-bold text-[#999]">데이터 불러오기</p>
          <p className="text-[10px] text-[#888]">서비스 데이터를 검색하거나 파일을 업로드</p>
        </div>

        <Tabs defaultValue="service">
          <TabsList className="w-full">
            <TabsTrigger value="service" className="flex-1 text-xs">서비스 데이터</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 text-xs">파일 업로드</TabsTrigger>
          </TabsList>

          {/* 서비스 데이터 탭 */}
          <TabsContent value="service" className="mt-2 space-y-2">
            {/* 회사 검색 */}
            <div className="relative" ref={companyDropdownRef}>
              <Label className="text-[10px] text-[#888]">회사 검색</Label>
              <Input
                value={companySearchTerm}
                onChange={(e) => {
                  setCompanySearchTerm(e.target.value)
                  if (e.target.value.length > 0) setCompanyDropdownOpen(true)
                }}
                onFocus={() => {
                  if (companies.length > 0) setCompanyDropdownOpen(true)
                }}
                placeholder="기업명 또는 종목코드 검색..."
                className="h-7 w-full text-xs bg-transparent border border-border/40 rounded-sm"
              />
              {companyDropdownOpen && companies.length > 0 && (
                <div className="absolute top-full left-0 z-[100] mt-0.5 w-full max-h-[200px] overflow-y-auto rounded-sm border border-border bg-card shadow-lg">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className="cursor-pointer px-2 py-1.5 text-[11px] transition-colors hover:bg-accent"
                      onClick={() => handleSelectCompany(company)}
                    >
                      <span>{company.name}</span>
                      {company.ticker && (
                        <span className="ml-1.5 text-muted-foreground">{company.ticker}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 조회 주기 + 지표 검색 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-[10px] text-[#888] whitespace-nowrap">조회 주기</Label>
                <Select value={state.dimensionKey} onValueChange={(value) => state.setDimensionKey(value as PageHDbDimensionKey)}>
                  <SelectTrigger size="sm" className="h-7 flex-1 text-xs bg-transparent border-b border-border/40 rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSION_OPTIONS.map((option) => (
                      <SelectItem key={`sa-dim-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-[10px] text-[#888] whitespace-nowrap">지표 검색</Label>
                <Input
                  value={state.metricSearchTerm}
                  onChange={(e) => state.setMetricSearchTerm(e.target.value)}
                  placeholder="metric 검색"
                  className="h-7 flex-1 text-xs bg-transparent border-b border-border/40 rounded-none"
                />
              </div>
            </div>

            {/* 통합 메트릭 트리 */}
            <div className="max-h-[260px] space-y-0.5 overflow-auto pt-1">
              {isMetricsLoading ? (
                <p className="text-[11px] text-[#888]">metric 로딩 중...</p>
              ) : unifiedGroups.length === 0 && !state.companyId && !uploadedSources.A && !uploadedSources.B ? (
                <p className="text-[11px] text-[#888]">
                  회사를 검색하거나 데이터를 업로드해 주세요.
                </p>
              ) : unifiedGroups.length === 0 ? (
                <p className="text-[11px] text-[#888]">표시할 metric이 없습니다.</p>
              ) : (
                unifiedGroups.map((sourceGroup) => (
                  <div key={sourceGroup.id} className="space-y-0.5">
                    <p className="text-[11px] font-bold text-[#999]">{sourceGroup.label}</p>
                    <CategoryTree
                      categories={sourceGroup.categories}
                      checkedKeys={state.checkedMetricKeySet}
                      fetchingKeys={state.fetchingMetricKeys}
                      onToggle={handleToggleMetric}
                    />
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* 파일 업로드 탭 */}
          <TabsContent value="upload" className="mt-2 space-y-2">
            <p className="text-[11px] text-[#888]">
              CSV, XLSX, XLS 파일을 업로드하여 데이터를 추가합니다.
            </p>

            {/* 슬롯 A 상태 */}
            <div className="bg-transparent border-b border-border/20 pb-2 space-y-1">
              <p className="text-xs font-medium">슬롯 A (기준 데이터)</p>
              {uploadedSources.A ? (
                <p className="text-[11px] text-muted-foreground truncate">
                  {uploadedSources.A.fileName} · {uploadedSources.A.columns.length}개 컬럼 · {uploadedSources.A.rowCount ?? "?"}행
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">업로드된 파일 없음</p>
              )}
            </div>

            {/* 슬롯 B 상태 */}
            <div className="bg-transparent border-b border-border/20 pb-2 space-y-1">
              <p className="text-xs font-medium">슬롯 B (비교 데이터)</p>
              {uploadedSources.B ? (
                <p className="text-[11px] text-muted-foreground truncate">
                  {uploadedSources.B.fileName} · {uploadedSources.B.columns.length}개 컬럼 · {uploadedSources.B.rowCount ?? "?"}행
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">업로드된 파일 없음</p>
              )}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={onOpenUploadDialog}
            >
              파일 업로드
            </Button>
          </TabsContent>
        </Tabs>
      </section>

      {/* 선택된 시리즈 태그 (공통) */}
      {selectedSeriesList.length > 0 && (
        <div className="space-y-1 pt-1.5 pb-1 border-b border-[#2a2a2a]">
          <p className="text-[11px] font-medium text-[#999]">선택된 시리즈 ({selectedSeriesList.length})</p>
          <div className="flex flex-wrap gap-1">
            {selectedSeriesList.map((item) => (
              <button
                key={item.metricKey}
                type="button"
                className="rounded-sm border border-[#444] px-1 py-px text-[11px] text-[#ccc] hover:bg-[#333] hover:border-[#666] hover:text-white"
                onClick={() => handleToggleMetric(item.metricKey)}
              >
                {item.label} {item.fetching ? "(로딩...)" : "×"}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-1.5 py-0.5 text-[10px] text-[#888] hover:text-white"
              onClick={state.clearAll}
            >
              선택 전체 해제
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      {/* Feature 2: 파생 지표 계산 */}
      <section ref={handleDerivedSectionRef} className="mt-6">
        <PageHDerivedPanel
          formulaOptions={DERIVED_FORMULA_PRESETS}
          selectedFormulaId={derivedState.state.formulaId}
          selectedFormulaInputCount={derivedFormulaPreset.inputCount}
          metricOptions={derivedMetricOptions}
          primaryMetricKey={derivedState.state.primaryMetricKey}
          secondaryMetricKey={derivedState.state.secondaryMetricKey}
          customName={derivedState.state.customName}
          error={derivedError}
          onFormulaChange={(formulaId) => derivedState.setFormulaId(formulaId as DerivedFormulaId)}
          onPrimaryMetricChange={derivedState.setPrimaryMetricKey}
          onSecondaryMetricChange={derivedState.setSecondaryMetricKey}
          onCustomNameChange={derivedState.setCustomName}
        />
      </section>
    </div>
  )
}
