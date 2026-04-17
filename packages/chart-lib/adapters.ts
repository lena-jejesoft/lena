import type {
  ChartType,
  ChartData,
  ChartStyle,
  CartesianStyle,
  ChartSeries,
  CartesianPoint,
  PointType,
} from "./types";
import type { StockPrice, FinancialMetric, Document, OhlcvRow, MetricItem } from "@/lib/types";

// ─── Type Converters ───

/**
 * OhlcvRow (pivoted DB type) → StockPrice (chart adapter type) 변환
 */
export function toStockPrice(ohlcv: OhlcvRow): StockPrice {
  return {
    date: ohlcv.ts_date,
    open: ohlcv.open ?? ohlcv.close,
    high: ohlcv.high ?? ohlcv.close,
    low: ohlcv.low ?? ohlcv.close,
    close: ohlcv.close,
    volume: ohlcv.volume ?? 0,
    tradingValue: ohlcv.turnover ?? undefined,
  };
}

/**
 * OhlcvRow[] → StockPrice[] 일괄 변환
 */
export function toStockPriceArray(ohlcvList: OhlcvRow[]): StockPrice[] {
  return ohlcvList.map(toStockPrice);
}

/**
 * MetricItem (DB type) → FinancialMetric (chart adapter type) 변환
 */
export function toFinancialMetric(fact: MetricItem): FinancialMetric {
  return {
    metric_type: fact.type?.name || "",
    period_type: (fact.period_type as "monthly" | "quarterly" | "yearly") || "quarterly",
    period_date: fact.ts_date,
    value: fact.value,
    is_forecast: fact.data?.is_forecast,
  };
}

/**
 * MetricItem[] → FinancialMetric[] 일괄 변환
 */
export function toFinancialMetricArray(facts: MetricItem[]): FinancialMetric[] {
  return facts.map(toFinancialMetric);
}

// ─── Stock / Financial Data → ChartData ───

type DocumentChartDef = {
  title: string;
  type: string;
  data?: Array<{ name: string; y: number; color?: string; isSum?: boolean }>;
  categories?: string[];
  series?: Array<{ name: string; data: number[]; color?: string }>;
};

const INDICATOR_COLORS: Record<string, string> = {
  stock: "#E57B53",
  revenue: "#B1ADA1",
  operatingProfit: "#da7756",
  netIncome: "#7D8471",
  per: "#D4A574",
  pbr: "#6B7B8C",
  revenueForecast: "#B1ADA1",
};

const INDICATOR_META: Record<
  string,
  { metricType: string; label: string; unit: string; yAxisId: string }
> = {
  revenue: { metricType: "revenue", label: "매출액", unit: "억원", yAxisId: "metric" },
  operatingProfit: { metricType: "operating_profit", label: "영업이익", unit: "억원", yAxisId: "metric" },
  netIncome: { metricType: "net_income", label: "순이익", unit: "억원", yAxisId: "metric" },
  per: { metricType: "per", label: "PER", unit: "배", yAxisId: "ratio" },
  pbr: { metricType: "pbr", label: "PBR", unit: "배", yAxisId: "ratio" },
};

export interface StockAdapterOptions {
  activeIndicators: string[];
  seriesVisibility: Record<string, boolean>;
  showForecast: boolean;
}

export function stockDataToChartData(
  stockData: StockPrice[],
  financialMetrics: FinancialMetric[],
  options: StockAdapterOptions
): ChartData {
  const series: ChartSeries<PointType>[] = [];

  // Stock price series
  const stockPoints: CartesianPoint[] = stockData.map((d) => ({
    x: new Date(d.date).getTime(),
    y: d.close,
  }));

  series.push({
    id: "stock",
    name: "주가",
    data: stockPoints,
    color: INDICATOR_COLORS.stock,
    yAxisId: "price",
    visible: options.seriesVisibility.stock !== false,
    lineWidth: 2,
  });

  // Financial indicator series
  for (const key of options.activeIndicators) {
    const meta = INDICATOR_META[key];
    if (!meta) continue;

    const metricData = financialMetrics
      .filter((m) => m.metric_type === meta.metricType && !m.is_forecast)
      .sort((a, b) => new Date(a.period_date).getTime() - new Date(b.period_date).getTime())
      .map((m): CartesianPoint => ({
        x: new Date(m.period_date).getTime(),
        y: m.value,
      }));

    const isColumn = key === "revenue";
    series.push({
      id: key,
      name: meta.label,
      data: metricData,
      color: INDICATOR_COLORS[key],
      yAxisId: meta.yAxisId,
      visible: options.seriesVisibility[key] !== false,
      chartType: isColumn ? "chartCore/column" : undefined,
      dashStyle: isColumn ? undefined : "ShortDash",
      opacity: isColumn ? 0.7 : undefined,
    });
  }

  // Revenue forecast
  if (options.showForecast) {
    const revenueActual = financialMetrics
      .filter((m) => m.metric_type === "revenue" && !m.is_forecast)
      .sort((a, b) => new Date(a.period_date).getTime() - new Date(b.period_date).getTime());

    const forecastMetrics = financialMetrics
      .filter((m) => m.metric_type === "revenue" && m.is_forecast)
      .sort((a, b) => new Date(a.period_date).getTime() - new Date(b.period_date).getTime());

    if (forecastMetrics.length > 0) {
      const forecastPoints: CartesianPoint[] = forecastMetrics.map((m) => ({
        x: new Date(m.period_date).getTime(),
        y: m.value,
      }));

      // Connect to last actual
      if (revenueActual.length > 0) {
        const last = revenueActual[revenueActual.length - 1];
        forecastPoints.unshift({
          x: new Date(last.period_date).getTime(),
          y: last.value,
        });
      }

      series.push({
        id: "revenueForecast",
        name: "매출 전망",
        data: forecastPoints,
        color: INDICATOR_COLORS.revenueForecast,
        yAxisId: "metric",
        dashStyle: "Dash",
        lineWidth: 2,
      });
    }
  }

  return {
    series,
    xAxisType: "datetime",
  };
}

export function stockDataDefaultStyle(): CartesianStyle {
  return {
    legend: { position: "none" },
    lineWidth: 2,
    tooltip: { shared: true },
    yAxes: [
      { id: "price", title: "", position: "left", gridLines: true },
      { id: "metric", title: "", position: "right", gridLines: false },
      { id: "ratio", title: "", position: "right", gridLines: false, visible: false },
    ],
  };
}

// ─── Document Chart → ChartData ───

export function documentChartToChartData(chart: DocumentChartDef): {
  data: ChartData;
  chartType: ChartType;
  style?: ChartStyle;
} {
  const { type, title, data, categories, series: chartSeries } = chart;

  if (type === "pie") {
    const pieData: CartesianPoint[] = (data ?? []).map((d) => ({
      x: d.name,
      y: d.y,
      color: d.color,
    }));

    return {
      chartType: "chartCore/pie",
      data: {
        xAxisType: "category",
        series: [{ id: "main", name: title, data: pieData }],
      },
      style: { title, dataLabels: true } as ChartStyle,
    };
  }

  if (type === "waterfall") {
    const waterfallData: CartesianPoint[] = (data ?? []).map((d) => ({
      x: d.name,
      y: d.y,
      isSum: d.isSum,
      color: d.color,
    }));

    return {
      chartType: "waterfall",
      data: {
        xAxisType: "category",
        series: [{ id: "main", name: title, data: waterfallData }],
      },
      style: { title } as ChartStyle,
    };
  }

  if (type === "comparison") {
    const compSeries: ChartSeries<PointType>[] = (chartSeries ?? []).map((s, i) => ({
      id: `series-${i}`,
      name: s.name,
      data: (categories ?? []).map((cat, j): CartesianPoint => ({
        x: cat,
        y: s.data[j] ?? 0,
      })),
      color: s.color,
    }));

    return {
      chartType: "chartCore/column",
      data: { xAxisType: "category", series: compSeries },
      style: { title, legend: { position: "bottom" } } as ChartStyle,
    };
  }

  // column / line / default
  const resolvedType: ChartType = type === "line" ? "chartCore/line" : "chartCore/column";
  const points: CartesianPoint[] = (data ?? []).map((d) => ({
    x: d.name,
    y: d.y,
  }));

  return {
    chartType: resolvedType,
    data: {
      xAxisType: "category",
      series: [{ id: "main", name: title, data: points }],
    },
    style: { title } as ChartStyle,
  };
}
