import type { ChartData } from "@/packages/chart-lib/types"
import type { CompanyMetricCatalogItem, MetricValueRow } from "./query"
import type { PageHDbMetricKey } from "./page-h-db"
import type {
  ResolvedSeries,
  SeriesTreeCategory,
  SeriesTreeGroup,
  SeriesTreeSourceGroup,
  UnifiedMetricNode,
  UploadedSourceInfo,
} from "./series-addition-types"

// --- 카테고리 분류 ---

type CategoryRule = {
  id: string
  label: string
  patterns: RegExp[]
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

const SOURCE_LABELS: Record<string, string> = {
  company: "회사 데이터",
  issuer: "재무제표 데이터",
}

const SOURCE_ORDER: Record<string, number> = {
  company: 0,
  issuer: 1,
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

type MetricPlacement = {
  categoryId: string
  categoryLabel: string
  groupPath: string[]
}

function resolveCategory(metricLabel: string, metricName: string, hierarchyPath?: string[]): MetricPlacement {
  const normalizedPath = normalizeHierarchyPath(hierarchyPath)
  if (normalizedPath.length > 0) {
    const [categoryLabel, ...groupPath] = normalizedPath
    return {
      categoryId: `path-${toPathToken(categoryLabel!)}`,
      categoryLabel: categoryLabel!,
      groupPath,
    }
  }

  const target = `${metricLabel} ${metricName}`
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

function matchesSearch(label: string, keyword: string): boolean {
  if (!keyword) return true
  return label.toLowerCase().includes(keyword)
}

// --- 트리 빌드 ---

type DraftTreeNode = {
  id: string
  label: string
  metrics: UnifiedMetricNode[]
  children: Map<string, DraftTreeNode>
}

type DraftCategoryNode = {
  id: string
  label: string
  metrics: UnifiedMetricNode[]
  groups: Map<string, DraftTreeNode>
}

function toTreeGroups(groups: Map<string, DraftTreeNode>): SeriesTreeGroup[] {
  return Array.from(groups.values())
    .map((group) => ({
      id: group.id,
      label: group.label,
      metrics: [...group.metrics].sort((a, b) => a.label.localeCompare(b.label, "ko")),
      children: toTreeGroups(group.children),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"))
}

function getGroupMetricCount(group: SeriesTreeGroup): number {
  return group.metrics.length + group.children.reduce((acc, child) => acc + getGroupMetricCount(child), 0)
}

function getCategoryMetricCount(category: SeriesTreeCategory): number {
  return category.metrics.length + category.groups.reduce((acc, group) => acc + getGroupMetricCount(group), 0)
}

function toCompanyMetricNode(catalog: CompanyMetricCatalogItem, companyId: string): UnifiedMetricNode {
  return {
    metricKey: `${companyId}:${catalog.entitySource}:${catalog.metricTypeId}`,
    label: catalog.metricLabel,
    unit: catalog.unit,
    origin: "company",
    metricTypeId: catalog.metricTypeId,
    entitySource: catalog.entitySource,
    dimensions: catalog.dimensions,
    hierarchyPath: catalog.hierarchyPath,
  }
}

function hasNumericValues(rows: Array<Record<string, string | number | null>>, column: string): boolean {
  return rows.some((row) => {
    const val = row[column]
    if (typeof val === "number") return Number.isFinite(val)
    if (typeof val === "string") return val.trim() !== "" && Number.isFinite(Number(val))
    return false
  })
}

function detectDateColumn(columns: string[]): string | null {
  const candidate = columns.find((col) => /date|ts_date|날짜|기간|period|time|연도|year|month|quarter/i.test(col))
  return candidate ?? null
}

function buildUploadMetricNodes(source: UploadedSourceInfo): UnifiedMetricNode[] {
  const dateColumn = detectDateColumn(source.columns) ?? source.columns[0] ?? ""
  return source.columns
    .filter((col) => col !== dateColumn)
    .filter((col) => hasNumericValues(source.rows, col))
    .map((col) => ({
      metricKey: `upload:${source.slot}:${col}`,
      label: col,
      origin: "upload" as const,
      uploadSlot: source.slot,
      columnName: col,
    }))
}

/**
 * 회사 메트릭 + 업로드 메트릭을 하나의 트리로 구성한다.
 */
export function buildUnifiedSourceGroups(
  companyMetrics: CompanyMetricCatalogItem[],
  companyName: string | null,
  companyId: string,
  uploadedSources: { A: UploadedSourceInfo | null; B: UploadedSourceInfo | null },
  metricSearchTerm: string
): SeriesTreeSourceGroup[] {
  const groups: SeriesTreeSourceGroup[] = []
  const keyword = metricSearchTerm.trim().toLowerCase()

  // 1. 회사 메트릭 (entitySource 별로 그룹핑)
  if (companyMetrics.length > 0) {
    const nodes = companyMetrics.map((c) => toCompanyMetricNode(c, companyId)).filter((node) => matchesSearch(node.label, keyword))

    // entitySource 별로 분리
    const bySource = new Map<string, UnifiedMetricNode[]>()
    for (const node of nodes) {
      const source = node.entitySource ?? "company"
      const list = bySource.get(source) ?? []
      list.push(node)
      bySource.set(source, list)
    }

    // SOURCE_ORDER 순서로 정렬
    const sortedSources = Array.from(bySource.entries()).sort(
      (a, b) => (SOURCE_ORDER[a[0]] ?? 99) - (SOURCE_ORDER[b[0]] ?? 99)
    )

    for (const [sourceId, sourceNodes] of sortedSources) {
      const categoryMap = new Map<string, DraftCategoryNode>()

      for (const node of sourceNodes) {
        const placement = resolveCategory(node.label, node.metricTypeId ?? "", node.hierarchyPath)

        if (!categoryMap.has(placement.categoryId)) {
          categoryMap.set(placement.categoryId, {
            id: placement.categoryId,
            label: placement.categoryLabel,
            metrics: [],
            groups: new Map(),
          })
        }

        const categoryNode = categoryMap.get(placement.categoryId)!
        if (placement.groupPath.length === 0) {
          categoryNode.metrics.push(node)
          continue
        }

        let groupMap = categoryNode.groups
        let currentNode: DraftTreeNode | null = null
        const traceSegments: string[] = []

        for (const segment of placement.groupPath) {
          traceSegments.push(segment)
          const mapKey = toPathToken(segment)
          if (!groupMap.has(mapKey)) {
            groupMap.set(mapKey, {
              id: `${sourceId}-${placement.categoryId}-${traceSegments.map(toPathToken).join("__")}`,
              label: segment,
              metrics: [],
              children: new Map(),
            })
          }
          currentNode = groupMap.get(mapKey)!
          groupMap = currentNode.children
        }

        if (currentNode) {
          currentNode.metrics.push(node)
        }
      }

      const categories: SeriesTreeCategory[] = Array.from(categoryMap.values())
        .map((cat) => ({
          id: cat.id,
          label: cat.label,
          metrics: [...cat.metrics].sort((a, b) => a.label.localeCompare(b.label, "ko")),
          groups: toTreeGroups(cat.groups),
        }))
        .sort((a, b) => {
          const aCount = getCategoryMetricCount(a)
          const bCount = getCategoryMetricCount(b)
          if (aCount === bCount) return a.label.localeCompare(b.label, "ko")
          return bCount - aCount
        })

      if (categories.length > 0) {
        const label = companyName
          ? `${companyName} ${SOURCE_LABELS[sourceId] ?? sourceId}`
          : (SOURCE_LABELS[sourceId] ?? sourceId)
        groups.push({ id: `company-${sourceId}`, label, origin: "company", categories })
      }
    }
  }

  // 2. 업로드 슬롯 A
  if (uploadedSources.A) {
    const uploadNodes = buildUploadMetricNodes(uploadedSources.A).filter((node) => matchesSearch(node.label, keyword))
    if (uploadNodes.length > 0) {
      groups.push({
        id: "upload-A",
        label: `업로드 A: ${uploadedSources.A.fileName}`,
        origin: "upload",
        categories: [{ id: "upload-A-all", label: "컬럼", metrics: uploadNodes, groups: [] }],
      })
    }
  }

  // 3. 업로드 슬롯 B
  if (uploadedSources.B) {
    const uploadNodes = buildUploadMetricNodes(uploadedSources.B).filter((node) => matchesSearch(node.label, keyword))
    if (uploadNodes.length > 0) {
      groups.push({
        id: "upload-B",
        label: `업로드 B: ${uploadedSources.B.fileName}`,
        origin: "upload",
        categories: [{ id: "upload-B-all", label: "컬럼", metrics: uploadNodes, groups: [] }],
      })
    }
  }

  return groups
}

/**
 * resolvedSeriesMap을 ChartData로 변환한다.
 */
export function buildChartDataFromResolvedSeries(
  checkedMetricKeys: PageHDbMetricKey[],
  resolvedSeriesMap: Map<PageHDbMetricKey, ResolvedSeries>
): ChartData | null {
  const orderedSeries = checkedMetricKeys
    .map((key) => resolvedSeriesMap.get(key))
    .filter((s): s is ResolvedSeries => s != null && s.rows.length > 0)

  if (orderedSeries.length === 0) return null

  return {
    xAxisType: "category",
    series: orderedSeries.map((s) => ({
      id: s.metricKey,
      name: s.label,
      unit: s.unit,
      data: [...s.rows]
        .sort((a, b) => a.ts_date.localeCompare(b.ts_date))
        .map((row) => ({ x: row.ts_date, y: row.value })),
    })),
  }
}

/**
 * 업로드 소스에서 특정 컬럼의 MetricValueRow[] 를 추출한다.
 */
export function extractUploadColumnAsRows(
  source: UploadedSourceInfo,
  columnName: string
): MetricValueRow[] {
  const dateColumn = detectDateColumn(source.columns) ?? source.columns[0] ?? ""
  return source.rows
    .map((row) => {
      const dateVal = String(row[dateColumn] ?? "")
      const numVal = Number(row[columnName])
      if (!dateVal || !Number.isFinite(numVal)) return null
      return { ts_date: dateVal, value: numVal }
    })
    .filter((r): r is MetricValueRow => r !== null)
}

/**
 * 트리에서 모든 메트릭 노드를 평탄화하여 추출한다.
 */
export function flattenMetricNodes(groups: SeriesTreeSourceGroup[]): UnifiedMetricNode[] {
  const result: UnifiedMetricNode[] = []

  function collectFromGroups(treeGroups: SeriesTreeGroup[]) {
    for (const group of treeGroups) {
      result.push(...group.metrics)
      collectFromGroups(group.children)
    }
  }

  for (const sourceGroup of groups) {
    for (const category of sourceGroup.categories) {
      result.push(...category.metrics)
      collectFromGroups(category.groups)
    }
  }

  return result
}
