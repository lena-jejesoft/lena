// ─── Core Entity Types ───

export type EntityType =
  | "company" | "currency" | "institution" | "index"
  | "stock" | "preferred" | "etf" | "derivative" | "commodity" | "crypto" | "fx";

export interface Entity {
  id: string;
  type_id: string;
  name: string;
  metadata: {
    is_active?: boolean;
    description?: string;
    [key: string]: unknown;
  };
  data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  type?: { name: string; metadata?: Record<string, unknown> };
}

// entity_item.data shape for company type
export interface EntityCompanyData {
  ticker?: string;
  market?: string;
  sector?: string;
  industry?: string;
  description?: string;
  logo_url?: string;
  website?: string;
  founded_year?: number;
  headquarters?: string;
  employee_count?: number;
  parent_company?: string;
  market_cap?: number;
  fiscal_month?: number;
  data_sources?: string[];
  game_ips?: string[];
  history?: Array<{ year: number; event: string }>;
  investment_points?: string[];
}

// ─── Source Types ───

export interface SourceItem {
  id: string;
  type_id: string;
  name: string;
  metadata: {
    is_active?: boolean;
    description?: string;
    [key: string]: unknown;
  };
  data: {
    category?: string;
    icon?: string;
    is_default?: boolean;
    sort_order?: number;
    reliability?: number;
    base_url?: string;
    [key: string]: unknown;
  };
  created_at?: string;
  updated_at?: string;
  type?: { name: string };
}

// ─── Metric Types ───

export interface MetricType {
  id: string;
  name: string;
  metadata: {
    name_en?: string;
    name_ko?: string;
    description?: string;
    unit?: string;
    group?: string;
    category?: string;
    [key: string]: unknown;
  };
  created_at?: string;
}

export interface MetricItem {
  id: string;
  type_id: string;
  entity_id: string;
  source_id?: string | null;
  ts_date: string;
  period_type: string;
  value: number;
  metadata: Record<string, unknown>;
  data: {
    is_forecast?: boolean;
    forecast_high?: number;
    forecast_low?: number;
    [key: string]: unknown;
  };
  created_at?: string;
  type?: { name: string; metadata?: Record<string, unknown> };
}

// Pivoted OHLCV row (presentation type)
export interface OhlcvRow {
  ts_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  turnover: number | null;
}

// UI presentation types
export interface StockPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradingValue?: number;
  adjustedClose?: number;
  change?: number;
  changePercent?: number;
}

export interface FinancialMetric {
  metric_type: string;
  period_type: "monthly" | "quarterly" | "yearly";
  period_date: string;
  value: number;
  unit?: string;
  currency?: string;
  is_forecast?: boolean;
  fiscal_year?: string;
  fiscal_quarter?: number;
}

// ─── Document Types ───

export interface DocumentItem {
  id: string;
  type_id: string;
  name: string;
  source_id: string | null;
  entity_id: string | null;
  metadata: {
    priority?: "high" | "medium" | "low";
    view_count?: number;
    [key: string]: unknown;
  };
  data: {
    content?: string;
    content_url?: string;
    summary?: string[];
    published_at?: string;
    charts?: Array<{
      title: string;
      type: string;
      data?: Array<{ name: string; y: number; color?: string; isSum?: boolean }>;
      categories?: string[];
      series?: Array<{ name: string; data: number[]; color?: string }>;
    }>;
    [key: string]: unknown;
  };
  created_at?: string;
  updated_at?: string;
  type?: { name: string };
}

// ─── Template Types ───

export type TemplateFieldType = "string" | "number" | "boolean" | "date" | "text";

export interface TemplateField {
  key: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  defaultValue?: string | number | boolean | null;
}

export interface TemplateSchema {
  fields: TemplateField[];
}

// ─── Event Types ───

export interface EventItem {
  id: string;
  type_id: string;
  entity_id: string | null;
  document_id: string | null;
  event_date: string;
  metadata: Record<string, unknown>;
  data: {
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
  created_at?: string;
  updated_at?: string;
  type?: { name: string; metadata?: Record<string, unknown> };
}

// ─── Joined/View Types (for convenience) ───

export interface Company {
  id: string;
  name: string;
  type_id?: string;
  ticker?: string | null;
  market?: string | null;
  sector?: string | null;
  description?: string | null;
  logo_url?: string | null;
  founded_year?: number | null;
  headquarters?: string | null;
  employee_count?: number | null;
  parent_company?: string | null;
  market_cap?: number | null;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

// Legacy aliases
export type DataSource = SourceItem;
export type Document = DocumentItem;
export type CalendarEvent = EventItem;

// ─── Common Types ───

export type PeriodType = "daily" | "month" | "quarter" | "year";
export type Theme = "dark" | "light";

export interface ChartTimeRange {
  min: number;
  max: number;
}

// ─── User Types ───

export interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  entity_id: string;
  notify_enabled: boolean;
  created_at?: string;
  entity?: Entity;
}

export type WatchlistCategory =
  | "전체"
  | "KOSPI"
  | "KOSDAQ"
  | "게임"
  | "상승"
  | "하락";

export interface WatchlistModalStock {
  id: number;
  name: string;
  ticker: string;
  change: string;
  category: WatchlistCategory[];
}

export interface WatchlistModalData {
  myList: number[];
  categories: WatchlistCategory[];
}

export interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorPosition?: {
    top?: number;
    bottom?: number;
    left?: number;
  };
}

export interface Notification {
  id: string;
  user_id: string;
  type: "entity" | "reply" | "mention" | "system";
  title: string;
  content: string | null;
  reference_id: string | null;
  reference_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type NotificationModalType = "company" | "reply";
export type NotificationModalTab = "all" | "company" | "reply" | "settings";
export type NotificationFrequency = "realtime" | "daily" | "weekly";

export interface NotificationModalItem extends Pick<Notification, "id" | "title"> {
  type: NotificationModalType;
  company?: string;
  content?: NonNullable<Notification["content"]>;
  author?: string;
  date: string;
  read: boolean;
}

export interface NotificationPostSettings {
  commentOnMyPost: boolean;
  replyToMyComment: boolean;
  mentionMe: boolean;
}

export interface NotificationModalSettings {
  companies: Record<string, boolean>;
  postNotifications: NotificationPostSettings;
  emailNotification: boolean;
  emailAddress: string;
  notificationFrequency: NotificationFrequency;
  soundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorPosition?: {
    top?: number;
    bottom?: number;
    left?: number;
  };
}

// ─── Forum Types ───

export interface ForumPost {
  id: string;
  author_id: string;
  title: string;
  content: string;
  category: "stock_analysis" | "industry_analysis" | "portfolio" | "free_discussion";
  tags: string[];
  entity_ids: string[];
  view_count: number;
  like_count: number;
  comment_count: number;
  chart_data: Record<string, unknown> | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
  replies?: ForumComment[];
}

export type ForumBoardCategory = "portfolio" | "stock" | "discussion" | "news";

export interface ForumBoardPost extends Pick<ForumPost, "title" | "content"> {
  id: number;
  category: ForumBoardCategory;
  categoryLabel: string;
  author: string;
  time: string;
  tickers: string[];
  likes: number;
  comments: number;
  views: number;
  awards: number;
  unread: boolean;
}

export interface ForumTopAuthor {
  name: string;
  views: number;
  posts: number;
}

export interface ForumHotTopic {
  name: string;
  ticker: string;
  change: string;
  positive: boolean;
}

export type ForumListTab = "all" | "popular" | "mine";
export type ForumSortType = "latest" | "popular" | "comments";

export interface ForumWriteForm {
  title: string;
  content: string;
  category: ForumBoardCategory;
  tickers: string;
}

export interface ForumUploadedImage {
  id: number;
  name: string;
  data: string;
}

export type ForumCategoryOption = Pick<ForumCategoryMeta, "category" | "label">;

export interface ForumChartPoint {
  date: Date;
  price: number;
}

export type CalendarBoardSource =
  | "earnings"
  | "dividend"
  | "conference"
  | "report"
  | "news"
  | "disclosure"
  | "sec"
  | "legislation"
  | "macro";

export interface CalendarBoardEvent {
  date: string;
  title: string;
  company: string;
  source: CalendarBoardSource;
}

export interface CalendarLegendItem {
  key: CalendarBoardSource;
  label: string;
  color: string;
}

export interface CalendarPieSlice {
  label: string;
  value: number;
  color: string;
}

export interface CalendarEventModalProps {
  event: CalendarBoardEvent;
  onClose: () => void;
}

export interface CalendarMiniCalendarProps {
  date: Date;
  onDateClick: (date: Date) => void;
  onMonthChange: (delta: number) => void;
}

export interface CalendarStatsPanelProps {
  currentDate: Date;
}

export interface CalendarMiniCell {
  dayNumber: number;
  cellDate: Date;
  isCurrentMonth: boolean;
}

export interface CalendarMonthCell {
  dayNumber: number;
  cellDate: Date;
  dateStr: string;
  isOtherMonth: boolean;
  dayOfWeek: number;
}

export type IndustryMainTab = "inter" | "intra";
export type IndustryIntraSubTab = "competitors" | "genres" | "regions";
export type IndustryGenreTrend = "up" | "down" | "stable";
export type IndustryMetricPresetKey =
  | "marketSize"
  | "profitability"
  | "growth"
  | "valuation";
export type IndustryMetricKey =
  | "marketCap"
  | "revenue"
  | "operatingMargin"
  | "netMargin"
  | "roe"
  | "revenueGrowth"
  | "profitGrowth"
  | "per"
  | "pbr"
  | "evEbitda";

export interface IndustryAnalysisIndustryInfo {
  name: string;
  size: number;
  growth: number;
}

export interface IndustryAnalysisCompanyInfo {
  name: IndustryCompany["name"];
  revenue: number;
  growth: number;
  market_cap: IndustryCompany["market_cap"];
}

export interface IndustryAnalysisGenreInfo {
  name: string;
  share: number;
  trend: IndustryGenreTrend;
}

export interface IndustryAnalysisRegionInfo {
  name: string;
  revenue: number;
  share: number;
}

export interface IndustryIntraItem {
  name: string;
  revenue?: number;
  growth?: number;
  market_cap?: number | null;
  share?: number;
  trend?: IndustryGenreTrend;
}

export interface IndustryExtendedData {
  industries: Record<string, IndustryAnalysisIndustryInfo>;
  companies: Record<string, IndustryAnalysisCompanyInfo>;
  genres: Record<string, IndustryAnalysisGenreInfo>;
  regions: Record<string, IndustryAnalysisRegionInfo>;
}

export interface IndustryNsicItem {
  id: string;
  name: string;
  code: string;
}

export interface IndustryNsicMinorItem extends IndustryNsicItem {
  nsic?: string;
}

export interface IndustryNsicClassification {
  major: IndustryNsicItem[];
  mid: Record<string, IndustryNsicItem[]>;
  minor: Record<string, IndustryNsicMinorItem[]>;
}

export interface IndustryMetricPreset {
  name: string;
  metrics: IndustryMetricKey[];
  unit: string;
}

export interface IndustryAvailableMetric {
  name: string;
  unit: string;
}

export interface IndustrySelectionOption {
  value: string;
  label: string;
}

export interface IndustrySubTabOption {
  key: IndustryIntraSubTab;
  label: string;
}

export interface IndustryNsicSelection {
  major: string | null;
  mid: string | null;
  minor: string | null;
}

// ─── Chart Types ───

export interface SavedChart {
  id: string;
  user_id: string;
  title: string;
  chart_type: string;
  config: Record<string, unknown>;
  data_source: Record<string, unknown> | null;
  thumbnail_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Category Metadata Types ───

export interface CategoryMeta {
  id: string;
  name: string;
  parent_id?: string | null;
  metadata: {
    name_ko?: string;
    color?: string;
    [key: string]: unknown;
  };
  sort_order: number;
}

export interface SourceCategoryMeta {
  category: string;
  label: string;
  color: string;
  sort_order: number;
}

export interface EventCategoryMeta {
  category: string;
  label: string;
  color: string;
  sort_order: number;
}

export interface ForumCategoryMeta {
  category: string;
  label: string;
  color: string;
  sort_order: number;
}

// ─── Feed Types ───

export interface FeedItem extends DocumentItem {
  source_name?: string;
  source_category?: string;
  entity_name?: string;
}

export type FeedPriority = NonNullable<DocumentItem["metadata"]["priority"]>;

export interface FeedSourceCategory {
  title: string;
  items: FeedItem[];
}

export type FeedCategoryOption = Pick<SourceCategoryMeta, "category" | "label">;

// ─── AI Types ───

export interface SearchIntent {
  entity: string | null;
  metrics: string[];
  timeRange: { start?: string; end?: string } | null;
  raw_query: string;
}

export interface AISummary {
  points: string[];
  financial_impact: string | null;
}

export interface ForecastInsight {
  summary: string;
  key_points: string[];
  confidence: "high" | "medium" | "low";
}

export interface IndustryCompany {
  id: string;
  name: string;
  market_cap: number | null;
  revenue: number | null;
  operating_profit: number | null;
  sector: string | null;
}

// ─── Log Types ───

export interface DataAcquisitionLog {
  id: string;
  entity_id: string | null;
  entity_name: string | null;
  data_type: string;
  source_id: string | null;
  status: string;
  date_range_start: string | null;
  date_range_end: string | null;
  records_count: number;
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
}
