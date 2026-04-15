import type { ChartData } from "@/packages/chart-lib/types"
import type { MetricValueRow } from "./query"
import type {
  HierarchyMetricCandidate,
  HierarchyMetricNode,
  HierarchySourceNode,
  HierarchyTreeNode,
} from "./page-h-hierarchy-types"

type HierarchySeriesInput = {
  metricKey: string
  seriesName: string
  unit?: string
  rows: MetricValueRow[]
}

type CategoryRule = {
  id: string
  label: string
  patterns: RegExp[]
}

type MetricPlacement = {
  categoryId: string
  categoryLabel: string
  groupPath: string[]
}

type DraftTreeNode = {
  id: string
  label: string
  metrics: HierarchyMetricNode[]
  children: Map<string, DraftTreeNode>
}

type DraftCategoryNode = {
  id: string
  label: string
  metrics: HierarchyMetricNode[]
  groups: Map<string, DraftTreeNode>
}

const SOURCE_LABELS: Record<string, string> = {
  company: "회사 데이터",
  issuer: "재무제표 데이터",
}

const SOURCE_ORDER: Record<string, number> = {
  company: 0,
  issuer: 1,
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    id: "income-statement",
    label: "손익 지표",
    patterns: [/매출|수익|영업이익|순이익|이익|revenue|income|profit/i],
  },
  {
    id: "balance-sheet",
    label: "재무상태 지표",
    patterns: [/자산|부채|자본|asset|liabil|equity/i],
  },
  {
    id: "ratio",
    label: "비율 지표",
    patterns: [/비율|마진|roe|roa|ratio|margin/i],
  },
  {
    id: "cashflow",
    label: "현금흐름 지표",
    patterns: [/현금|cash/i],
  },
]

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase()
}

function toPathToken(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣_-]/g, "")
  return normalized || "node"
}

function normalizeHierarchyPath(path: string[] | undefined): string[] {
  if (!Array.isArray(path)) return []
  return path.map((item) => item.trim()).filter((item) => item.length > 0)
}

function resolveCategory(metric: HierarchyMetricCandidate): MetricPlacement {
  const hierarchyPath = normalizeHierarchyPath(metric.hierarchyPath)
  if (hierarchyPath.length > 0) {
    const [categoryLabel, ...groupPath] = hierarchyPath
    return {
      categoryId: `path-${toPathToken(categoryLabel)}`,
      categoryLabel,
      groupPath,
    }
  }

  const target = `${metric.label} ${metric.metricName}`
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(target))) {
      return {
        categoryId: rule.id,
        categoryLabel: rule.label,
        groupPath: [],
      }
    }
  }
  return {
    categoryId: "others",
    categoryLabel: "기타 지표",
    groupPath: [],
  }
}

function matchesSearch(metric: HierarchyMetricCandidate, keyword: string): boolean {
  if (!keyword) return true
  const target = `${metric.label} ${metric.metricName} ${metric.metricTypeId} ${normalizeHierarchyPath(metric.hierarchyPath).join(" ")}`.toLowerCase()
  return target.includes(keyword)
}

function toHierarchyTreeNodes(groups: Map<string, DraftTreeNode>): HierarchyTreeNode[] {
  return Array.from(groups.values())
    .map((group) => ({
      id: group.id,
      label: group.label,
      metrics: [...group.metrics].sort((a, b) => a.label.localeCompare(b.label, "ko")),
      children: toHierarchyTreeNodes(group.children),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"))
}

function getTreeNodeMetricCount(node: HierarchyTreeNode): number {
  return node.metrics.length + node.children.reduce((acc, child) => acc + getTreeNodeMetricCount(child), 0)
}

export function buildHierarchySourceNodes(
  metrics: HierarchyMetricCandidate[],
  metricSearchTerm: string
): HierarchySourceNode[] {
  const keyword = normalizeKeyword(metricSearchTerm)
  const filtered = metrics.filter((metric) => matchesSearch(metric, keyword))

  const sourceCategoryMap = new Map<string, Map<string, DraftCategoryNode>>()

  filtered.forEach((metric) => {
    const placement = resolveCategory(metric)
    const sourceId = metric.entitySource

    if (!sourceCategoryMap.has(sourceId)) {
      sourceCategoryMap.set(sourceId, new Map())
    }

    const categoryMap = sourceCategoryMap.get(sourceId)!
    if (!categoryMap.has(placement.categoryId)) {
      categoryMap.set(placement.categoryId, {
        id: placement.categoryId,
        label: placement.categoryLabel,
        metrics: [],
        groups: new Map(),
      })
    }

    const metricNode: HierarchyMetricNode = {
      ...metric,
      categoryId: placement.categoryId,
      categoryLabel: placement.categoryLabel,
    }

    const categoryNode = categoryMap.get(placement.categoryId)!
    if (placement.groupPath.length === 0) {
      categoryNode.metrics.push(metricNode)
      return
    }

    let groupMap = categoryNode.groups
    let currentNode: DraftTreeNode | null = null
    const traceSegments: string[] = []

    for (const segment of placement.groupPath) {
      traceSegments.push(segment)
      const mapKey = toPathToken(segment)
      if (!groupMap.has(mapKey)) {
        groupMap.set(mapKey, {
          id: `${sourceId}-${placement.categoryId}-${traceSegments.map((item) => toPathToken(item)).join("__")}`,
          label: segment,
          metrics: [],
          children: new Map(),
        })
      }

      currentNode = groupMap.get(mapKey)!
      groupMap = currentNode.children
    }

    if (currentNode) {
      currentNode.metrics.push(metricNode)
    }
  })

  return Array.from(sourceCategoryMap.entries())
    .map(([sourceId, categoryMap]) => {
      const categories = Array.from(categoryMap.values())
        .map((category) => ({
          id: category.id,
          label: category.label,
          metrics: [...category.metrics].sort((a, b) => a.label.localeCompare(b.label, "ko")),
          groups: toHierarchyTreeNodes(category.groups),
        }))
        .sort((a, b) => {
          const aCount = a.metrics.length + a.groups.reduce((acc, group) => acc + getTreeNodeMetricCount(group), 0)
          const bCount = b.metrics.length + b.groups.reduce((acc, group) => acc + getTreeNodeMetricCount(group), 0)
          if (aCount === bCount) return a.label.localeCompare(b.label, "ko")
          return bCount - aCount
        })

      return {
        id: sourceId as "company" | "issuer",
        label: SOURCE_LABELS[sourceId] ?? sourceId,
        categories,
      }
    })
    .sort((a, b) => {
      const left = SOURCE_ORDER[a.id] ?? 99
      const right = SOURCE_ORDER[b.id] ?? 99
      if (left === right) return a.label.localeCompare(b.label, "ko")
      return left - right
    })
}

export function buildChartDataFromHierarchySeries(seriesList: HierarchySeriesInput[]): ChartData | null {
  const normalized = seriesList
    .map((series) => ({
      ...series,
      rows: [...series.rows].sort((a, b) => a.ts_date.localeCompare(b.ts_date)),
    }))
    .filter((series) => series.rows.length > 0)

  if (normalized.length === 0) return null

  return {
    xAxisType: "category",
    series: normalized.map((series) => ({
      id: series.metricKey,
      name: series.seriesName,
      unit: series.unit,
      data: series.rows.map((row) => ({
        x: row.ts_date,
        y: row.value,
      })),
    })),
  }
}
