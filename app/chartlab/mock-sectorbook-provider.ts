import type {
  CompanyMetricCatalogItem,
  MetricDimension,
  MetricEntitySource,
  MetricValueRow,
  OhlcvRow,
} from "./query"

export type MockSectorbookCompany = {
  id: string
  name: string
  ticker: string
  market: string
}

type FetchCompaniesParams = {
  searchKeyword?: string
  limit?: number
}

type FetchCompanyOhlcvRowsParams = {
  companyId?: string
  companyName?: string
  useFuzzyNameMatch?: boolean
  startDate?: string
  endDate?: string
}

type FetchCompanyMetricCatalogParams = {
  companyId?: string
  companyName?: string
  useFuzzyNameMatch?: boolean
}

type FetchCompanyMetricRowsParams = {
  companyId?: string
  companyName?: string
  useFuzzyNameMatch?: boolean
  metricTypeId: string
  entitySource: MetricEntitySource
  dimension?: MetricDimension | "auto"
  startDate?: string
  endDate?: string
}

type MockMetricDefinition = {
  metricTypeId: string
  metricName: string
  metricLabel: string
  unit?: string
  entitySource: MetricEntitySource
  dimensions: MetricDimension[]
  hierarchyPath: string[]
  baseValue: number
  trendPerStep: number
  seasonalScale: number
}

const DEFAULT_LOOKBACK_YEARS = 1
const MS_PER_DAY = 24 * 60 * 60 * 1000

const MOCK_COMPANIES: MockSectorbookCompany[] = [
  { id: "company-samsung-securities", name: "삼성증권", ticker: "016360", market: "KOSPI" },
  { id: "company-sk-hynix", name: "SK하이닉스", ticker: "000660", market: "KOSPI" },
  { id: "company-naver", name: "NAVER", ticker: "035420", market: "KOSPI" },
  { id: "company-kakao", name: "카카오", ticker: "035720", market: "KOSPI" },
  { id: "company-lg-energy", name: "LG에너지솔루션", ticker: "373220", market: "KOSPI" },
]

const METRIC_DIMENSION_PRIORITY: MetricDimension[] = ["daily", "monthly", "quarterly", "yearly"]

const MOCK_METRICS: MockMetricDefinition[] = [
  {
    metricTypeId: "mock.revenue",
    metricName: "revenue",
    metricLabel: "매출액",
    unit: "억원",
    entitySource: "company",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["손익 지표", "수익", "매출액"],
    baseValue: 120_000 * 10,
    trendPerStep: 0.024,
    seasonalScale: 0.08,
  },
  {
    metricTypeId: "mock.operatingIncome",
    metricName: "operating_income",
    metricLabel: "영업이익",
    unit: "억원",
    entitySource: "company",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["손익 지표", "수익", "영업이익"],
    baseValue: 13_500,
    trendPerStep: 0.018,
    seasonalScale: 0.11,
  },
  {
    metricTypeId: "mock.netIncome",
    metricName: "net_income",
    metricLabel: "당기순이익",
    unit: "억원",
    entitySource: "company",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["손익 지표", "수익", "당기순이익"],
    baseValue: 9_300,
    trendPerStep: 0.016,
    seasonalScale: 0.13,
  },
  {
    metricTypeId: "mock.costOfSales",
    metricName: "cost_of_sales",
    metricLabel: "매출원가",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["손익 지표", "비용", "매출원가"],
    baseValue: 72_000,
    trendPerStep: 0.015,
    seasonalScale: 0.07,
  },
  {
    metricTypeId: "mock.sgaExpense",
    metricName: "sga_expense",
    metricLabel: "판관비",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["손익 지표", "비용", "판관비"],
    baseValue: 18_300,
    trendPerStep: 0.012,
    seasonalScale: 0.08,
  },
  {
    metricTypeId: "mock.currentAssets",
    metricName: "current_assets",
    metricLabel: "유동자산",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["재무상태 지표", "자산", "유동자산"],
    baseValue: 320_000,
    trendPerStep: 0.014,
    seasonalScale: 0.05,
  },
  {
    metricTypeId: "mock.nonCurrentAssets",
    metricName: "non_current_assets",
    metricLabel: "비유동자산",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["재무상태 지표", "자산", "비유동자산"],
    baseValue: 510_000,
    trendPerStep: 0.012,
    seasonalScale: 0.04,
  },
  {
    metricTypeId: "mock.assetTotal",
    metricName: "asset_total",
    metricLabel: "자산총계",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["재무상태 지표", "자산", "자산총계"],
    baseValue: 890_000,
    trendPerStep: 0.013,
    seasonalScale: 0.04,
  },
  {
    metricTypeId: "mock.currentLiabilities",
    metricName: "current_liabilities",
    metricLabel: "유동부채",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["재무상태 지표", "부채", "유동부채"],
    baseValue: 205_000,
    trendPerStep: 0.01,
    seasonalScale: 0.05,
  },
  {
    metricTypeId: "mock.nonCurrentLiabilities",
    metricName: "non_current_liabilities",
    metricLabel: "비유동부채",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["재무상태 지표", "부채", "비유동부채"],
    baseValue: 248_000,
    trendPerStep: 0.009,
    seasonalScale: 0.05,
  },
  {
    metricTypeId: "mock.totalEquity",
    metricName: "total_equity",
    metricLabel: "자본",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["재무상태 지표", "자본", "자본총계"],
    baseValue: 437_000,
    trendPerStep: 0.011,
    seasonalScale: 0.045,
  },
  {
    metricTypeId: "mock.debtRatio",
    metricName: "debt_ratio",
    metricLabel: "부채비율",
    unit: "%",
    entitySource: "issuer",
    dimensions: ["monthly", "quarterly"],
    hierarchyPath: ["비율 지표", "안정성", "부채비율"],
    baseValue: 102,
    trendPerStep: -0.002,
    seasonalScale: 0.03,
  },
  {
    metricTypeId: "mock.roe",
    metricName: "roe",
    metricLabel: "ROE",
    unit: "%",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["비율 지표", "수익성", "ROE"],
    baseValue: 11.5,
    trendPerStep: 0.006,
    seasonalScale: 0.1,
  },
  {
    metricTypeId: "mock.operatingCashflow",
    metricName: "operating_cash_flow",
    metricLabel: "영업활동",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["현금흐름 지표", "현금흐름", "영업활동"],
    baseValue: 19_500,
    trendPerStep: 0.012,
    seasonalScale: 0.12,
  },
  {
    metricTypeId: "mock.investingCashflow",
    metricName: "investing_cash_flow",
    metricLabel: "투자활동",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["현금흐름 지표", "현금흐름", "투자활동"],
    baseValue: -8_300,
    trendPerStep: 0.008,
    seasonalScale: 0.13,
  },
  {
    metricTypeId: "mock.financingCashflow",
    metricName: "financing_cash_flow",
    metricLabel: "재무활동",
    unit: "억원",
    entitySource: "issuer",
    dimensions: ["quarterly", "yearly"],
    hierarchyPath: ["현금흐름 지표", "현금흐름", "재무활동"],
    baseValue: -5_900,
    trendPerStep: 0.004,
    seasonalScale: 0.1,
  },
]

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDateInput(value: string | undefined, fallback: Date): Date {
  if (!value) return new Date(fallback)
  const parsed = new Date(`${value}T00:00:00`)
  if (!Number.isFinite(parsed.getTime())) return new Date(fallback)
  return parsed
}

function resolveDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - DEFAULT_LOOKBACK_YEARS)
  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  }
}

function normalizeSearchKeyword(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase()
}

function getHashSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function findMockCompany(params: {
  companyId?: string
  companyName?: string
  useFuzzyNameMatch?: boolean
}): MockSectorbookCompany | null {
  if (params.companyId) {
    const byId = MOCK_COMPANIES.find((company) => company.id === params.companyId)
    if (byId) return byId
  }

  const normalizedName = normalizeSearchKeyword(params.companyName)
  if (!normalizedName) return null

  if (params.useFuzzyNameMatch) {
    return MOCK_COMPANIES.find((company) => company.name.toLowerCase().includes(normalizedName)) ?? null
  }

  return MOCK_COMPANIES.find((company) => company.name.toLowerCase() === normalizedName) ?? null
}

function sortDimensions(dimensions: MetricDimension[]): MetricDimension[] {
  return [...dimensions].sort(
    (a, b) => METRIC_DIMENSION_PRIORITY.indexOf(a) - METRIC_DIMENSION_PRIORITY.indexOf(b)
  )
}

function resolveTargetDimension(
  supported: MetricDimension[],
  requested: MetricDimension | "auto" | undefined
): MetricDimension {
  if (requested && requested !== "auto" && supported.includes(requested)) {
    return requested
  }
  return sortDimensions(supported)[0] ?? "yearly"
}

function normalizeDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const defaults = resolveDefaultDateRange()
  const start = parseDateInput(startDate, new Date(`${defaults.startDate}T00:00:00`))
  const end = parseDateInput(endDate, new Date(`${defaults.endDate}T00:00:00`))
  if (start.getTime() <= end.getTime()) return { start, end }
  return { start: end, end: start }
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function firstDayOfQuarter(date: Date): Date {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3
  return new Date(date.getFullYear(), quarterMonth, 1)
}

function firstDayOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

function getDimensionStepDate(date: Date, dimension: MetricDimension): Date {
  if (dimension === "daily") return new Date(date.getTime() + MS_PER_DAY)
  if (dimension === "monthly") return new Date(date.getFullYear(), date.getMonth() + 1, 1)
  if (dimension === "quarterly") return new Date(date.getFullYear(), date.getMonth() + 3, 1)
  return new Date(date.getFullYear() + 1, 0, 1)
}

function alignDateByDimension(date: Date, dimension: MetricDimension): Date {
  if (dimension === "daily") return new Date(date)
  if (dimension === "monthly") return firstDayOfMonth(date)
  if (dimension === "quarterly") return firstDayOfQuarter(date)
  return firstDayOfYear(date)
}

function buildDateSequence(startDate: string | undefined, endDate: string | undefined, dimension: MetricDimension): string[] {
  const { start, end } = normalizeDateRange(startDate, endDate)
  let cursor = alignDateByDimension(start, dimension)

  const values: string[] = []
  while (cursor.getTime() <= end.getTime()) {
    if (dimension === "daily") {
      const day = cursor.getDay()
      // 주말은 제외해 거래일 시계열 형태를 맞춘다.
      if (day !== 0 && day !== 6) {
        values.push(toDateString(cursor))
      }
    } else {
      values.push(toDateString(cursor))
    }
    cursor = getDimensionStepDate(cursor, dimension)
  }

  if (values.length === 0) {
    values.push(toDateString(alignDateByDimension(start, dimension)))
  }

  return values
}

function roundNumber(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function buildMetricRows(companyId: string, metric: MockMetricDefinition, dimension: MetricDimension, startDate?: string, endDate?: string): MetricValueRow[] {
  const dates = buildDateSequence(startDate, endDate, dimension)
  const seed = getHashSeed(`${companyId}:${metric.metricTypeId}:${dimension}`)
  const phase = (seed % 17) / 3
  const scale = 1 + (seed % 29) / 100

  return dates.map((tsDate, index) => {
    const trend = 1 + metric.trendPerStep * index
    const seasonal = 1 + Math.sin((index + phase) * 0.9) * metric.seasonalScale
    const noise = 1 + Math.cos((index + phase) * 0.35) * (metric.seasonalScale * 0.35)
    const value = metric.baseValue * scale * trend * seasonal * noise

    if (metric.metricTypeId === "mock.debtRatio" || metric.metricTypeId === "mock.roe") {
      return { ts_date: tsDate, value: roundNumber(Math.max(value, 0.1), 2) }
    }

    return { ts_date: tsDate, value: Math.max(Math.round(value), 0) }
  })
}

function resolveBasePrice(companyId: string): number {
  const seed = getHashSeed(companyId)
  const bands = [42_000, 61_000, 98_000, 131_000, 185_000]
  return bands[seed % bands.length] ?? 75_000
}

function buildOhlcvRows(companyId: string, startDate?: string, endDate?: string): OhlcvRow[] {
  const dates = buildDateSequence(startDate, endDate, "daily")
  const seed = getHashSeed(`${companyId}:ohlcv`)
  const phase = (seed % 31) / 7

  let prevClose = resolveBasePrice(companyId)

  return dates.map((tsDate, index) => {
    const drift = 1 + 0.0004 * index
    const openMove = Math.sin((index + phase) * 0.37) * 0.012
    const closeMove = Math.cos((index + phase) * 0.41) * 0.014
    const highPad = Math.abs(Math.sin((index + phase) * 0.53)) * 0.015 + 0.003
    const lowPad = Math.abs(Math.cos((index + phase) * 0.47)) * 0.014 + 0.003

    const open = Math.max(prevClose * drift * (1 + openMove), 100)
    const close = Math.max(open * (1 + closeMove), 100)
    const high = Math.max(open, close) * (1 + highPad)
    const low = Math.max(Math.min(open, close) * (1 - lowPad), 50)

    prevClose = close

    const volume = Math.round(400_000 + (seed % 120_000) + Math.abs(Math.sin(index * 0.2 + phase)) * 600_000)
    const turnover = Math.round(close * volume)

    return {
      ts_date: tsDate,
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
      volume,
      turnover,
    }
  })
}

export async function fetchMockSectorbookCompanies(
  params: FetchCompaniesParams = {}
): Promise<{
  items: MockSectorbookCompany[]
  error: string | null
}> {
  const keyword = normalizeSearchKeyword(params.searchKeyword)
  const limit = Number.isFinite(Number(params.limit)) ? Math.max(1, Math.floor(Number(params.limit))) : 30

  const filtered = keyword
    ? MOCK_COMPANIES.filter((company) => {
      return (
        company.name.toLowerCase().includes(keyword) ||
        company.ticker.toLowerCase().includes(keyword) ||
        company.market.toLowerCase().includes(keyword)
      )
    })
    : MOCK_COMPANIES

  return {
    items: filtered.slice(0, limit),
    error: null,
  }
}

export async function fetchMockSectorbookMetricCatalog(
  params: FetchCompanyMetricCatalogParams
): Promise<{
  items: CompanyMetricCatalogItem[]
  companyName: string | null
  error: string | null
}> {
  const company = findMockCompany(params)

  if (!company) {
    return {
      items: [],
      companyName: null,
      error: params.companyName
        ? `${params.companyName} company 엔티티를 찾을 수 없습니다.`
        : "company 엔티티를 찾을 수 없습니다.",
    }
  }

  const items = MOCK_METRICS
    .map((metric) => ({
      metricTypeId: metric.metricTypeId,
      metricName: metric.metricName,
      metricLabel: metric.metricLabel,
      unit: metric.unit,
      entitySource: metric.entitySource,
      dimensions: sortDimensions(metric.dimensions),
      hierarchyPath: metric.hierarchyPath,
    }))
    .sort((a, b) => a.metricLabel.localeCompare(b.metricLabel, "ko"))

  return {
    items,
    companyName: company.name,
    error: null,
  }
}

export async function fetchMockSectorbookMetricRows(
  params: FetchCompanyMetricRowsParams
): Promise<{
  rows: MetricValueRow[]
  companyName: string | null
  metricName: string | null
  error: string | null
}> {
  const company = findMockCompany(params)

  if (!company) {
    return {
      rows: [],
      companyName: null,
      metricName: null,
      error: params.companyName
        ? `${params.companyName} company 엔티티를 찾을 수 없습니다.`
        : "company 엔티티를 찾을 수 없습니다.",
    }
  }

  const metric = MOCK_METRICS.find((item) => item.metricTypeId === params.metricTypeId)
  if (!metric) {
    return {
      rows: [],
      companyName: company.name,
      metricName: null,
      error: `요청한 metric_type(${params.metricTypeId})을 찾을 수 없습니다.`,
    }
  }

  if (metric.entitySource !== params.entitySource) {
    return {
      rows: [],
      companyName: company.name,
      metricName: metric.metricLabel,
      error: `요청한 entitySource(${params.entitySource})가 metric source(${metric.entitySource})와 일치하지 않습니다.`,
    }
  }

  const targetDimension = resolveTargetDimension(metric.dimensions, params.dimension)
  const rows = buildMetricRows(company.id, metric, targetDimension, params.startDate, params.endDate)

  return {
    rows,
    companyName: company.name,
    metricName: metric.metricLabel,
    error: null,
  }
}

export async function fetchMockSectorbookOhlcvRows(
  params: FetchCompanyOhlcvRowsParams
): Promise<{
  rows: OhlcvRow[]
  companyName: string | null
  error: string | null
}> {
  const company = findMockCompany(params)

  if (!company) {
    return {
      rows: [],
      companyName: null,
      error: params.companyName
        ? `${params.companyName} company 엔티티를 찾을 수 없습니다.`
        : "company 엔티티를 찾을 수 없습니다.",
    }
  }

  const rows = buildOhlcvRows(company.id, params.startDate, params.endDate)

  return {
    rows,
    companyName: company.name,
    error: null,
  }
}

export const mockSectorbookProvider = {
  fetchCompanies: fetchMockSectorbookCompanies,
  fetchMetricCatalog: fetchMockSectorbookMetricCatalog,
  fetchMetricRows: fetchMockSectorbookMetricRows,
  fetchOhlcvRows: fetchMockSectorbookOhlcvRows,
}
