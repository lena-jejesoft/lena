import { ChartData, OHLCPoint } from "@/components/chart/types";
import { createClient } from "@/lib/supabase/client";

export const OHLCV_METRIC_NAMES = ["open", "high", "low", "close", "volume", "turnover"] as const;
export type OhlcvMetricName = (typeof OHLCV_METRIC_NAMES)[number];

export type OhlcvRow = {
  ts_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  turnover: number | null;
};

type FetchCompanyOhlcvRowsParams = {
  companyId?: string;
  companyName?: string;
  useFuzzyNameMatch?: boolean;
  startDate?: string;
  endDate?: string;
};

export type MetricDimension = "daily" | "monthly" | "quarterly" | "yearly";
export type MetricEntitySource = "company" | "issuer";

export type MetricValueRow = {
  ts_date: string;
  value: number;
};

type FetchCompanyMetricRowsParams = {
  companyId?: string;
  companyName?: string;
  useFuzzyNameMatch?: boolean;
  metricTypeId: string;
  entitySource: MetricEntitySource;
  dimension?: MetricDimension | "auto";
  startDate?: string;
  endDate?: string;
};

type FetchCompanyMetricCatalogParams = {
  companyId?: string;
  companyName?: string;
  useFuzzyNameMatch?: boolean;
  startDate?: string;
  endDate?: string;
};

export type CompanyMetricCatalogItem = {
  metricTypeId: string;
  metricName: string;
  metricLabel: string;
  unit?: string;
  entitySource: MetricEntitySource;
  dimensions: MetricDimension[];
  hierarchyPath?: string[];
};

export function toLightweightCandlesChartData(points: OHLCPoint[]): ChartData {
  const normalized = points
    .filter((point) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.open) &&
      Number.isFinite(point.high) &&
      Number.isFinite(point.low) &&
      Number.isFinite(point.close)
    )
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((point) => ({
      x: point.x,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: typeof point.volume === "number" && !Number.isNaN(point.volume) ? point.volume : null,
      turnover: typeof point.turnover === "number" && !Number.isNaN(point.turnover) ? point.turnover : null,
    }));

  return {
    xAxisType: "datetime",
    series: [
      {
        id: "lightweight-candles",
        name: "삼성증권",
        data: normalized,
      },
    ],
  };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  return {
    startDate: toDateString(fiveYearsAgo),
    endDate: toDateString(now),
  };
}

async function fetchCompanyEntity(
  supabase: ReturnType<typeof createClient>,
  params: FetchCompanyOhlcvRowsParams
): Promise<{ id: string; name: string } | null> {
  const { companyId, companyName, useFuzzyNameMatch } = params;

  if (companyId) {
    const { data: companyById, error } = await supabase
      .from("entity_item")
      .select("id, name, type:entity_type!inner(name)")
      .eq("id", companyId)
      .eq("type.name", "company")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (companyById?.id && companyById?.name) {
      return { id: companyById.id, name: companyById.name };
    }
  }

  if (!companyName) return null;

  const query = useFuzzyNameMatch
    ? supabase
        .from("entity_item")
        .select("id, name, type:entity_type!inner(name)")
        .eq("type.name", "company")
        .ilike("name", `%${companyName}%`)
        .order("name")
        .limit(1)
        .maybeSingle()
    : supabase
        .from("entity_item")
        .select("id, name, type:entity_type!inner(name)")
        .eq("type.name", "company")
        .eq("name", companyName)
        .limit(1)
        .maybeSingle();

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id || !data?.name) return null;
  return { id: data.id, name: data.name };
}

function normalizeMetricDimension(value: unknown): MetricDimension | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "daily") return "daily";
  if (normalized === "monthly" || normalized === "month") return "monthly";
  if (normalized === "quarterly" || normalized === "quarter") return "quarterly";
  if (normalized === "yearly" || normalized === "year" || normalized === "annual") return "yearly";
  return null;
}

async function resolveCompanyEntities(
  supabase: ReturnType<typeof createClient>,
  params: FetchCompanyOhlcvRowsParams
): Promise<{
  company: { id: string; name: string } | null;
  issuerEntityId: string | null;
}> {
  const company = await fetchCompanyEntity(supabase, params);
  if (!company?.id) {
    return { company: null, issuerEntityId: null };
  }

  const issuerQuery = supabase
    .from("relation_item")
    .select("to_entity_id, type:relation_type!inner(name)")
    .eq("from_entity_id", company.id)
    .eq("type.name", "Issuer")
    .limit(1)
    .maybeSingle();
  const { data: issuerRelation, error } = await issuerQuery;
  if (error) {
    throw new Error(error.message);
  }

  return {
    company,
    issuerEntityId: issuerRelation?.to_entity_id ?? null,
  };
}

export async function fetchCompanyOhlcvRows(
  supabase: ReturnType<typeof createClient>,
  params: FetchCompanyOhlcvRowsParams
): Promise<{
  rows: OhlcvRow[];
  companyName: string | null;
  error: string | null;
}> {
  const defaultRange = resolveDefaultDateRange();
  const startDate = params.startDate ?? defaultRange.startDate;
  const endDate = params.endDate ?? defaultRange.endDate;

  let company: { id: string; name: string } | null = null;
  let issuerEntityId: string | null = null;
  try {
    const resolved = await resolveCompanyEntities(supabase, params);
    company = resolved.company;
    issuerEntityId = resolved.issuerEntityId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "회사 조회 중 오류가 발생했습니다.";
    return { rows: [], companyName: null, error: message };
  }

  if (!company?.id) {
    return {
      rows: [],
      companyName: null,
      error: params.companyName
        ? `${params.companyName} company 엔티티를 찾을 수 없습니다.`
        : "company 엔티티를 찾을 수 없습니다.",
    };
  }

  if (!issuerEntityId) {
    return { rows: [], companyName: company.name, error: `${company.name} Issuer 관계를 찾을 수 없습니다.` };
  }

  const metricTypeQuery = supabase
    .from("metric_type")
    .select("id, name")
    .in("name", [...OHLCV_METRIC_NAMES]);
  const { data: metricTypes, error: metricTypeError } = await metricTypeQuery;
  if (metricTypeError) {
    return { rows: [], companyName: company.name, error: metricTypeError.message };
  }
  if (!metricTypes || metricTypes.length === 0) {
    return { rows: [], companyName: company.name, error: "OHLCV metric_type을 찾을 수 없습니다." };
  }

  const typeMap = new Map<string, OhlcvMetricName>();
  metricTypes.forEach((typeRow) => {
    if (OHLCV_METRIC_NAMES.includes(typeRow.name as OhlcvMetricName)) {
      typeMap.set(typeRow.id, typeRow.name as OhlcvMetricName);
    }
  });
  const typeIds = Array.from(typeMap.keys());
  if (typeIds.length === 0) {
    return { rows: [], companyName: company.name, error: "OHLCV type_id를 구성할 수 없습니다." };
  }

  const metricItemQuery = supabase
    .from("metric_item")
    .select("ts_date, value, type_id")
    .eq("entity_id", issuerEntityId)
    .in("type_id", typeIds)
    .gte("ts_date", startDate)
    .lte("ts_date", endDate)
    .order("ts_date", { ascending: true });
  const { data: metricItems, error: metricItemError } = await metricItemQuery;
  if (metricItemError) {
    return { rows: [], companyName: company.name, error: metricItemError.message };
  }
  if (!metricItems || metricItems.length === 0) {
    return { rows: [], companyName: company.name, error: null };
  }

  const grouped = new Map<string, Partial<Record<OhlcvMetricName, number>>>();
  for (const row of metricItems) {
    const typeName = typeMap.get(row.type_id);
    if (!typeName) continue;
    const value = Number(row.value);
    if (Number.isNaN(value)) continue;
    const current = grouped.get(row.ts_date) ?? {};
    current[typeName] = value;
    grouped.set(row.ts_date, current);
  }

  const rows: OhlcvRow[] = [];
  for (const [tsDate, values] of grouped.entries()) {
    const open = values.open;
    const high = values.high;
    const low = values.low;
    const close = values.close;

    if (
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number"
    ) {
      continue;
    }

    rows.push({
      ts_date: tsDate,
      open,
      high,
      low,
      close,
      volume: typeof values.volume === "number" ? values.volume : null,
      turnover: typeof values.turnover === "number" ? values.turnover : null,
    });
  }
  rows.sort((a, b) => a.ts_date.localeCompare(b.ts_date));

  return { rows, companyName: company.name, error: null };
}

export async function fetchCompanyMetricCatalog(
  supabase: ReturnType<typeof createClient>,
  params: FetchCompanyMetricCatalogParams
): Promise<{
  items: CompanyMetricCatalogItem[];
  companyName: string | null;
  error: string | null;
}> {
  let company: { id: string; name: string } | null = null;
  let issuerEntityId: string | null = null;
  try {
    const resolved = await resolveCompanyEntities(supabase, params);
    company = resolved.company;
    issuerEntityId = resolved.issuerEntityId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "회사 조회 중 오류가 발생했습니다.";
    return { items: [], companyName: null, error: message };
  }

  if (!company?.id) {
    return {
      items: [],
      companyName: null,
      error: params.companyName
        ? `${params.companyName} company 엔티티를 찾을 수 없습니다.`
        : "company 엔티티를 찾을 수 없습니다.",
    };
  }

  const entityIds = [company.id];
  if (issuerEntityId) {
    entityIds.push(issuerEntityId);
  }

  // 날짜 범위 내에 데이터가 있는 메트릭만 카탈로그에 포함
  const defaultRange = resolveDefaultDateRange();
  const catalogStartDate = params.startDate ?? defaultRange.startDate;
  const catalogEndDate = params.endDate ?? defaultRange.endDate;

  const { data: metricItems, error: metricItemsError } = await supabase
    .from("metric_item")
    .select("type_id, period_type, entity_id")
    .in("entity_id", entityIds)
    .gte("ts_date", catalogStartDate)
    .lte("ts_date", catalogEndDate);

  if (metricItemsError) {
    return { items: [], companyName: company.name, error: metricItemsError.message };
  }

  if (!metricItems || metricItems.length === 0) {
    return { items: [], companyName: company.name, error: null };
  }

  const catalogMap = new Map<
    string,
    {
      entitySource: MetricEntitySource;
      dimensions: Set<MetricDimension>;
    }
  >();

  for (const item of metricItems) {
    const existing = catalogMap.get(item.type_id) ?? {
      entitySource: "company" as MetricEntitySource,
      dimensions: new Set<MetricDimension>(),
    };
    const currentSource: MetricEntitySource =
      issuerEntityId && item.entity_id === issuerEntityId ? "issuer" : "company";
    if (existing.entitySource !== "company" && currentSource === "company") {
      existing.entitySource = "company";
    } else if (!catalogMap.has(item.type_id)) {
      existing.entitySource = currentSource;
    }

    const normalizedDimension = normalizeMetricDimension(item.period_type);
    if (normalizedDimension) {
      existing.dimensions.add(normalizedDimension);
    }
    catalogMap.set(item.type_id, existing);
  }

  const typeIds = Array.from(catalogMap.keys());

  // metric_type 메타데이터와 카테고리 링크를 병렬 조회
  const [metricTypesResult, categoryLinksResult] = await Promise.all([
    supabase.from("metric_type").select("id, name, metadata").in("id", typeIds),
    supabase
      .from("metric_type_category")
      .select(
        "type_id, category:metric_category(id, name, parent_id, sort_order, system:metric_category_system(name))"
      )
      .in("type_id", typeIds),
  ]);

  const { data: metricTypes, error: metricTypesError } = metricTypesResult;
  if (metricTypesError) {
    return { items: [], companyName: company.name, error: metricTypesError.message };
  }

  // 카테고리 계층 빌드 (실패해도 hierarchyPath 없이 진행)
  type CategoryInfo = { name: string; parent_id: string | null; systemName: string };
  const categoryById = new Map<string, CategoryInfo>();
  const typeCategoryGroups = new Map<string, Array<{ id: string; systemName: string }>>();

  if (!categoryLinksResult.error && categoryLinksResult.data) {
    const missingParentIds: string[] = [];

    for (const link of categoryLinksResult.data) {
      // Supabase PostgREST FK join: category는 단일 객체, system도 단일 객체이지만 타입은 배열로 추론될 수 있음
      const rawCat = link.category;
      const cat = (Array.isArray(rawCat) ? rawCat[0] : rawCat) as {
        id: string; name: string; parent_id: string | null;
        sort_order: number; system: { name: string } | { name: string }[] | null;
      } | null;
      if (!cat) continue;

      const rawSys = cat.system;
      const systemName = rawSys ? (Array.isArray(rawSys) ? rawSys[0]?.name : rawSys.name) ?? "" : "";
      categoryById.set(cat.id, { name: cat.name, parent_id: cat.parent_id, systemName });

      if (cat.parent_id && !categoryById.has(cat.parent_id)) {
        missingParentIds.push(cat.parent_id);
      }

      const group = typeCategoryGroups.get(link.type_id) ?? [];
      group.push({ id: cat.id, systemName });
      typeCategoryGroups.set(link.type_id, group);
    }

    // 부모 카테고리가 누락된 경우 추가 조회
    const uniqueMissingIds = [...new Set(missingParentIds)].filter((id) => !categoryById.has(id));
    if (uniqueMissingIds.length > 0) {
      const { data: parentCats } = await supabase
        .from("metric_category")
        .select("id, name, parent_id, system:metric_category_system(name)")
        .in("id", uniqueMissingIds);
      for (const cat of parentCats ?? []) {
        const rawSys = (cat as { system: { name: string } | { name: string }[] | null }).system;
        const sysName = rawSys ? (Array.isArray(rawSys) ? rawSys[0]?.name : rawSys.name) ?? "" : "";
        categoryById.set(cat.id, { name: cat.name, parent_id: cat.parent_id, systemName: sysName });
      }
    }
  }

  // type_id → hierarchyPath 빌드
  function buildHierarchyPath(typeId: string): string[] | undefined {
    const cats = typeCategoryGroups.get(typeId);
    if (!cats || cats.length === 0) return undefined;

    // dart_statement_type → 최상위 카테고리
    let statementTypeName: string | null = null;
    for (const c of cats) {
      if (c.systemName === "dart_statement_type") {
        statementTypeName = categoryById.get(c.id)?.name ?? null;
        break;
      }
    }

    // dart_account_class → parent chain 순회
    let accountClassChain: string[] = [];
    for (const c of cats) {
      if (c.systemName === "dart_account_class") {
        const chain: string[] = [];
        let currentId: string | null = c.id;
        let depth = 0;
        while (currentId && depth < 10) {
          const cat = categoryById.get(currentId);
          if (!cat) break;
          chain.unshift(cat.name);
          currentId = cat.parent_id;
          depth++;
        }
        accountClassChain = chain;
        break;
      }
    }

    if (!statementTypeName && accountClassChain.length === 0) return undefined;

    const path: string[] = [];
    if (statementTypeName) path.push(statementTypeName);
    path.push(...accountClassChain);
    return path.length > 0 ? path : undefined;
  }

  const dimensionPriority: MetricDimension[] = ["daily", "monthly", "quarterly", "yearly"];
  const items = (metricTypes ?? [])
    .flatMap((metricType) => {
      const catalog = catalogMap.get(metricType.id);
      if (!catalog) return [];

      const metadata = (metricType.metadata as Record<string, unknown> | null) ?? {};
      const label = String(metadata.name_ko ?? "").trim() || metricType.name;
      const unit = String(metadata.unit ?? "").trim() || undefined;
      const dimensions = Array.from(catalog.dimensions).sort(
        (a, b) => dimensionPriority.indexOf(a) - dimensionPriority.indexOf(b)
      );

      return [{
        metricTypeId: metricType.id,
        metricName: metricType.name,
        metricLabel: label,
        unit,
        entitySource: catalog.entitySource,
        dimensions,
        hierarchyPath: buildHierarchyPath(metricType.id),
      } satisfies CompanyMetricCatalogItem];
    })
    .sort((a, b) => a.metricLabel.localeCompare(b.metricLabel, "ko"));

  return {
    items,
    companyName: company.name,
    error: null,
  };
}

export async function fetchCompanyMetricRows(
  supabase: ReturnType<typeof createClient>,
  params: FetchCompanyMetricRowsParams
): Promise<{
  rows: MetricValueRow[];
  companyName: string | null;
  metricName: string | null;
  error: string | null;
}> {
  const defaultRange = resolveDefaultDateRange();
  const startDate = params.startDate ?? defaultRange.startDate;
  const endDate = params.endDate ?? defaultRange.endDate;

  let company: { id: string; name: string } | null = null;
  let issuerEntityId: string | null = null;
  try {
    const resolved = await resolveCompanyEntities(supabase, params);
    company = resolved.company;
    issuerEntityId = resolved.issuerEntityId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "회사 조회 중 오류가 발생했습니다.";
    return { rows: [], companyName: null, metricName: null, error: message };
  }

  if (!company?.id) {
    return {
      rows: [],
      companyName: null,
      metricName: null,
      error: params.companyName
        ? `${params.companyName} company 엔티티를 찾을 수 없습니다.`
        : "company 엔티티를 찾을 수 없습니다.",
    };
  }

  const { data: metricType, error: metricTypeError } = await supabase
    .from("metric_type")
    .select("id, name, metadata")
    .eq("id", params.metricTypeId)
    .limit(1)
    .maybeSingle();
  if (metricTypeError) {
    return { rows: [], companyName: company.name, metricName: null, error: metricTypeError.message };
  }
  if (!metricType?.id) {
    return {
      rows: [],
      companyName: company.name,
      metricName: null,
      error: `요청한 metric_type(${params.metricTypeId})을 찾을 수 없습니다.`,
    };
  }
  const metricMeta = (metricType.metadata as Record<string, unknown> | null) ?? {};
  const metricDisplayName = String(metricMeta.name_ko ?? "").trim() || metricType.name;

  if (params.entitySource === "issuer" && !issuerEntityId) {
    return {
      rows: [],
      companyName: company.name,
      metricName: metricDisplayName,
      error: `${company.name} Issuer 관계를 찾을 수 없습니다.`,
    };
  }

  const targetEntityId = params.entitySource === "issuer" ? issuerEntityId! : company.id;

  let metricItemsQuery = supabase
    .from("metric_item")
    .select("ts_date, value")
    .eq("entity_id", targetEntityId)
    .eq("type_id", params.metricTypeId)
    .gte("ts_date", startDate)
    .lte("ts_date", endDate)
    .order("ts_date", { ascending: true });

  if (params.dimension && params.dimension !== "auto") {
    metricItemsQuery = metricItemsQuery.eq("period_type", params.dimension);
  }

  let { data: metricItems, error: metricItemsError } = await metricItemsQuery;
  if (metricItemsError) {
    return { rows: [], companyName: company.name, metricName: metricDisplayName, error: metricItemsError.message };
  }

  // period_type이 비어 있는 데이터셋을 위해 dimension 필터 실패 시 1회 재조회한다.
  if ((metricItems?.length ?? 0) === 0 && params.dimension && params.dimension !== "auto") {
    const fallbackQuery = supabase
      .from("metric_item")
      .select("ts_date, value")
      .eq("entity_id", targetEntityId)
      .eq("type_id", params.metricTypeId)
      .gte("ts_date", startDate)
      .lte("ts_date", endDate)
      .order("ts_date", { ascending: true });
    const fallback = await fallbackQuery;
    metricItems = fallback.data ?? [];
    metricItemsError = fallback.error;
    if (metricItemsError) {
      return { rows: [], companyName: company.name, metricName: metricDisplayName, error: metricItemsError.message };
    }
  }

  const rows = (metricItems ?? [])
    .map((item) => ({
      ts_date: item.ts_date,
      value: Number(item.value),
    }))
    .filter((item) => Number.isFinite(item.value));

  return {
    rows,
    companyName: company.name,
    metricName: metricDisplayName,
    error: null,
  };
}

export async function fetchSamsungSecuritiesOhlcv(supabase: ReturnType<typeof createClient>): Promise<{
  points: OHLCPoint[];
  error: string | null;
}> {
  const { rows, error } = await fetchCompanyOhlcvRows(supabase, {
    companyName: "삼성증권",
    useFuzzyNameMatch: true,
  });
  if (error || rows.length === 0) {
    return { points: [], error };
  }

  return {
    points: rows.map((row) => ({
      x: new Date(`${row.ts_date}T00:00:00`).getTime(),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      turnover: row.turnover,
    })),
    error: null,
  };
}
