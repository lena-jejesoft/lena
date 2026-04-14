"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PageHDbCompanyOption, PageHDbDimensionKey } from "./page-h-db"
import type { HierarchySelectedMetric, HierarchySourceNode, HierarchyTreeNode } from "./page-h-hierarchy-types"

type PageHHierarchyPanelProps = {
  companies: PageHDbCompanyOption[]
  companyId: string
  companySearchTerm: string
  metricSearchTerm: string
  dimensionKey: PageHDbDimensionKey
  sourceNodes: HierarchySourceNode[]
  selectedMetricKeys: string[]
  selectedMetrics: HierarchySelectedMetric[]
  isCompaniesLoading: boolean
  isMetricsLoading: boolean
  isApplying: boolean
  error: string | null
  onCompanyIdChange: (companyId: string) => void
  onCompanySearchTermChange: (value: string) => void
  onMetricSearchTermChange: (value: string) => void
  onDimensionKeyChange: (dimensionKey: PageHDbDimensionKey) => void
  onSearchCompanies: () => void
  onToggleMetric: (metricKey: string) => void
  onRemoveMetric: (metricKey: string) => void
  onClearMetrics: () => void
  onApply: () => void
}

const DIMENSION_OPTIONS: Array<{ value: PageHDbDimensionKey; label: string }> = [
  { value: "auto", label: "자동" },
  { value: "daily", label: "일간" },
  { value: "monthly", label: "월간" },
  { value: "quarterly", label: "분기" },
  { value: "yearly", label: "연간" },
]

function getTreeMetricCount(node: HierarchyTreeNode): number {
  return node.metrics.length + node.children.reduce((acc, child) => acc + getTreeMetricCount(child), 0)
}

type HierarchyGroupTreeProps = {
  nodes: HierarchyTreeNode[]
  selectedMetricKeys: string[]
  onToggleMetric: (metricKey: string) => void
  depth?: number
}

function HierarchyGroupTree({ nodes, selectedMetricKeys, onToggleMetric, depth = 0 }: HierarchyGroupTreeProps) {
  if (nodes.length === 0) return null

  return (
    <div className={depth > 0 ? "space-y-0.5 pl-3" : "space-y-0.5"}>
      {nodes.map((node) => {
        const metricCount = getTreeMetricCount(node)
        return (
          <details key={`group-${node.id}`} open className="hierarchy-tree group/tree">
            <summary className="cursor-pointer text-[11px] font-medium text-[#ccc] flex items-center gap-1 py-0.5 hover:text-white">
              <span className="text-[9px] text-[#666] inline-block transition-transform duration-150 group-open/tree:rotate-90">›</span>
              {node.label} ({metricCount})
            </summary>
            <div className="mt-0.5 space-y-0.5 pl-2">
              {node.metrics.map((metric) => {
                const checked = selectedMetricKeys.includes(metric.metricKey)
                return (
                  <label
                    key={`metric-${metric.metricKey}`}
                    className="flex cursor-pointer items-center gap-1.5 px-1 py-px text-[11px] text-[#ccc] hover:bg-[#333]/60 hover:text-white [&_input]:accent-primary"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleMetric(metric.metricKey)}
                      className="h-3 w-3"
                    />
                    <span className="truncate">{metric.label}</span>
                  </label>
                )
              })}
              <HierarchyGroupTree
                nodes={node.children}
                selectedMetricKeys={selectedMetricKeys}
                onToggleMetric={onToggleMetric}
                depth={depth + 1}
              />
            </div>
          </details>
        )
      })}
    </div>
  )
}

export function PageHHierarchyPanel({
  companies,
  companyId,
  companySearchTerm,
  metricSearchTerm,
  dimensionKey,
  sourceNodes,
  selectedMetricKeys,
  selectedMetrics,
  isCompaniesLoading,
  isMetricsLoading,
  isApplying,
  error,
  onCompanyIdChange,
  onCompanySearchTermChange,
  onMetricSearchTermChange,
  onDimensionKeyChange,
  onSearchCompanies,
  onToggleMetric,
  onRemoveMetric,
  onClearMetrics,
  onApply,
}: PageHHierarchyPanelProps) {
  const canApply = companyId.length > 0 && selectedMetricKeys.length > 0 && !isApplying

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-[#999]">계층 탐색</p>
          <p className="text-[10px] text-[#888]">회사/지표를 선택해 차트를 생성합니다.</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs chartlab-style-number-input"
          onClick={onApply}
          disabled={!canApply}
        >
          {isApplying ? "반영 중..." : "차트 반영"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <Label className="text-[10px] text-[#888]">회사 검색</Label>
        <div className="flex gap-1.5">
          <Input
            value={companySearchTerm}
            onChange={(event) => onCompanySearchTermChange(event.target.value)}
            placeholder="회사명 검색"
            className="h-7 text-xs chartlab-style-number-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs chartlab-style-number-input"
            onClick={onSearchCompanies}
            disabled={isCompaniesLoading}
          >
            {isCompaniesLoading ? "조회 중..." : "검색"}
          </Button>
        </div>

        <Label className="text-[10px] text-[#888]">회사 선택</Label>
        <Select value={companyId} onValueChange={onCompanyIdChange}>
          <SelectTrigger size="sm" className="h-7 text-xs chartlab-style-number-input">
            <SelectValue placeholder="회사를 선택해 주세요" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
                {company.ticker ? ` (${company.ticker})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="space-y-1">
            <Label className="text-[10px] text-[#888]">조회 주기</Label>
            <Select value={dimensionKey} onValueChange={(value) => onDimensionKeyChange(value as PageHDbDimensionKey)}>
              <SelectTrigger size="sm" className="h-7 text-xs chartlab-style-number-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSION_OPTIONS.map((option) => (
                  <SelectItem key={`hierarchy-dimension-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-[#888]">지표 검색</Label>
            <Input
              value={metricSearchTerm}
              onChange={(event) => onMetricSearchTermChange(event.target.value)}
              placeholder="metric 검색"
              className="h-7 text-xs chartlab-style-number-input"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1 pt-1.5 pb-1 border-b border-[#2a2a2a]">
        <p className="text-[11px] font-medium text-[#999]">선택된 metric ({selectedMetrics.length})</p>
        {selectedMetrics.length === 0 ? (
          <p className="text-[11px] text-[#888]">선택된 metric이 없습니다.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {selectedMetrics.map((metric) => (
                <button
                  key={`selected-${metric.metricKey}`}
                  type="button"
                  className="rounded-sm border border-[#444] px-1 py-px text-[11px] text-[#ccc] hover:bg-[#333] hover:border-[#666] hover:text-white"
                  onClick={() => onRemoveMetric(metric.metricKey)}
                >
                  {metric.label} ×
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="px-1.5 py-0.5 text-[10px] text-[#888] hover:text-white"
                onClick={onClearMetrics}
              >
                선택 전체 해제
              </button>
            </div>
          </>
        )}
      </div>

      <div className="max-h-[260px] space-y-0.5 overflow-auto pt-1">
        {isMetricsLoading ? (
          <p className="text-[11px] text-[#888]">metric 로딩 중...</p>
        ) : sourceNodes.length === 0 ? (
          <p className="text-[11px] text-[#888]">표시할 metric이 없습니다.</p>
        ) : (
          sourceNodes.map((source) => (
            <div key={`source-${source.id}`} className="space-y-0.5">
              <p className="text-[11px] font-bold text-[#999]">{source.label}</p>
              {source.categories.map((category) => (
                <details key={`category-${source.id}-${category.id}`} open className="hierarchy-tree group/cat">
                  <summary className="cursor-pointer text-[11px] font-medium text-[#ccc] flex items-center gap-1 py-0.5 hover:text-white">
                    <span className="text-[9px] text-[#666] inline-block transition-transform duration-150 group-open/cat:rotate-90">›</span>
                    {category.label} ({category.metrics.length + category.groups.reduce((acc, group) => acc + getTreeMetricCount(group), 0)})
                  </summary>
                  <div className="mt-0.5 space-y-0.5 pl-3">
                    {category.metrics.map((metric) => {
                      const checked = selectedMetricKeys.includes(metric.metricKey)
                      return (
                        <label
                          key={`metric-${metric.metricKey}`}
                          className="flex cursor-pointer items-center gap-1.5 px-1 py-px text-[11px] text-[#ccc] hover:bg-[#333]/60 hover:text-white [&_input]:accent-primary"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleMetric(metric.metricKey)}
                            className="h-3 w-3"
                          />
                          <span className="truncate">{metric.label}</span>
                        </label>
                      )
                    })}
                    <HierarchyGroupTree
                      nodes={category.groups}
                      selectedMetricKeys={selectedMetricKeys}
                      onToggleMetric={onToggleMetric}
                    />
                  </div>
                </details>
              ))}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
