"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  CartesianStyle,
  ChartData,
  ChartStyle,
  ChartType,
  Scenario,
} from "@/packages/chart-lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CHART_TYPE_OPTIONS } from "./chart-type-options";

type SidebarChartBlock = {
  chartType: ChartType;
  style: ChartStyle;
  data: ChartData;
};

type ChartBlockSidebarProps = {
  block: SidebarChartBlock;
  onChartTypeChange: (type: ChartType) => void;
  onStyleChange: (style: ChartStyle) => void;
};

const DEFAULT_COLORS = [
  "#E57B53", "#7D8471", "#9B8AA6", "#5B8DB8", "#D4A853",
  "#6BAF8D", "#C97B84", "#8B7355",
];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// ─── ChartBlockSidebar ───

export function ChartBlockSidebar({
  block,
  onChartTypeChange,
  onStyleChange,
}: {
  block: SidebarChartBlock;
  onChartTypeChange: (type: ChartType) => void;
  onStyleChange: (style: ChartStyle) => void;
}) {
  const [activeTab, setActiveTab] = useState<"data" | "style">("data");

  return (
    <div
      className="w-[220px] min-w-[220px] border-r border-border bg-secondary/20 flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tab toggle */}
      <div className="m-2.5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "data" | "style")}>
          <TabsList className="w-full">
            <TabsTrigger value="data" className="flex-1 text-xs">데이터</TabsTrigger>
            <TabsTrigger value="style" className="flex-1 text-xs">스타일</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "data" ? (
          <SidebarDataTab block={block} onChartTypeChange={onChartTypeChange} onStyleChange={onStyleChange} />
        ) : (
          <SidebarStyleTab block={block} onStyleChange={onStyleChange} />
        )}
      </div>
    </div>
  );
}

function SidebarDataTab({
  block,
  onChartTypeChange,
  onStyleChange,
}: ChartBlockSidebarProps) {
  const lightweightCandlesCfg = (block.style as CartesianStyle | undefined)?.lightweightCandles;
  const lightweightScenario: Scenario = lightweightCandlesCfg?.scenario ?? "BASE";
  const lightweightShowBandsIndicator = lightweightCandlesCfg?.showBandsIndicator !== false;
  const lightweightShowVolume = lightweightCandlesCfg?.showVolume !== false;
  const lightweightShowMa5 = lightweightCandlesCfg?.showMa5 !== false;
  const lightweightHasVolumeData = useMemo(() => {
    if (block.chartType !== "lightweight/candles") return false;
    const raw = (block.data.series?.[0]?.data ?? []) as unknown[];
    return raw.some((row) => isObjectRecord(row) && typeof row.volume === "number" && !Number.isNaN(row.volume));
  }, [block.chartType, block.data.series]);

  const setLightweightShowVolume = (showVolume: boolean) => {
    const base = (block.style as CartesianStyle) ?? {};
    const next: CartesianStyle = {
      ...base,
      lightweightCandles: {
        ...(base.lightweightCandles ?? {}),
        maPeriod: base.lightweightCandles?.maPeriod ?? 5,
        showVolume,
      },
    };
    onStyleChange(next as ChartStyle);
  };

  const setLightweightShowMa5 = (showMa5: boolean) => {
    const base = (block.style as CartesianStyle) ?? {};
    const next: CartesianStyle = {
      ...base,
      lightweightCandles: {
        ...(base.lightweightCandles ?? {}),
        maPeriod: base.lightweightCandles?.maPeriod ?? 5,
        showMa5,
      },
    };
    onStyleChange(next as ChartStyle);
  };

  const setLightweightScenario = (scenario: Scenario) => {
    const base = (block.style as CartesianStyle) ?? {};
    const next: CartesianStyle = {
      ...base,
      lightweightCandles: {
        ...(base.lightweightCandles ?? {}),
        maPeriod: base.lightweightCandles?.maPeriod ?? 5,
        scenario,
      },
    };
    onStyleChange(next as ChartStyle);
  };

  const setLightweightShowBandsIndicator = (showBandsIndicator: boolean) => {
    const base = (block.style as CartesianStyle) ?? {};
    const next: CartesianStyle = {
      ...base,
      lightweightCandles: {
        ...(base.lightweightCandles ?? {}),
        maPeriod: base.lightweightCandles?.maPeriod ?? 5,
        showBandsIndicator,
      },
    };
    onStyleChange(next as ChartStyle);
  };

  return (
    <div className="flex flex-col">
      <SidebarSection title="차트 유형">
        <Select value={block.chartType} onValueChange={(value) => onChartTypeChange(value as ChartType)}>
          <SelectTrigger size="sm" className="w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_TYPE_OPTIONS.map((option) => {
              const isCurrent = option.value === block.chartType;
              const isWip = option.wip === true;
              const isDisabled = !isCurrent && isWip;
              const suffix = isWip ? " (개발 중)" : "";
              return (
                <SelectItem key={option.value} value={option.value} disabled={isDisabled}>
                  {option.label}{suffix}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {block.chartType === "lightweight/candles" && (
          <>
            <div className="text-[10px] text-muted-foreground mb-1.5 mt-3">시나리오 밴드</div>
            <Select value={lightweightScenario} onValueChange={(value) => setLightweightScenario(value as Scenario)}>
              <SelectTrigger size="sm" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BASE">BASE</SelectItem>
                <SelectItem value="BULL">BULL</SelectItem>
                <SelectItem value="BEAR">BEAR</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-[10px] text-muted-foreground mb-1.5 mt-3">BandsIndicator</div>
            <Select
              value={lightweightShowBandsIndicator ? "1" : "0"}
              onValueChange={(value) => setLightweightShowBandsIndicator(value === "1")}
            >
              <SelectTrigger size="sm" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">표시</SelectItem>
                <SelectItem value="0">숨김</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-[10px] text-muted-foreground mb-1.5 mt-3">거래량</div>
            <Select
              value={lightweightShowVolume ? "1" : "0"}
              onValueChange={(value) => setLightweightShowVolume(value === "1")}
              disabled={!lightweightHasVolumeData}
            >
              <SelectTrigger size="sm" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">표시</SelectItem>
                <SelectItem value="0">숨김</SelectItem>
              </SelectContent>
            </Select>
            {!lightweightHasVolumeData && (
              <div className="text-[10px] text-muted-foreground mt-1">
                volume 데이터가 없어 비활성화됩니다.
              </div>
            )}

            <div className="text-[10px] text-muted-foreground mb-1.5 mt-3">이평선 (5일)</div>
            <Select
              value={lightweightShowMa5 ? "1" : "0"}
              onValueChange={(value) => setLightweightShowMa5(value === "1")}
            >
              <SelectTrigger size="sm" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">표시</SelectItem>
                <SelectItem value="0">숨김</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </SidebarSection>

      {block.chartType.startsWith("recharts/") ? null : (
        <SidebarSection title="X축">
          <div className="text-[10px] text-muted-foreground mb-1.5">필드</div>
          <Select value={block.data.xAxisType} disabled>
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">카테고리</SelectItem>
              <SelectItem value="datetime">날짜/시간</SelectItem>
              <SelectItem value="numeric">숫자</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 mt-2">
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground mb-1">스케일 유형</div>
              <Select value={block.data.xAxisType} disabled>
                <SelectTrigger size="sm" className="w-full text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">카테고리</SelectItem>
                  <SelectItem value="datetime">날짜/시간</SelectItem>
                  <SelectItem value="numeric">숫자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground mb-1">정렬</div>
              <Select defaultValue="ascending">
                <SelectTrigger size="sm" className="w-full text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ascending">오름차순</SelectItem>
                  <SelectItem value="descending">내림차순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SidebarSection>
      )}

      {block.chartType.startsWith("recharts/") ? null : (
        <SidebarSection
          title="Y축"
          action={<span className="text-[10px] text-primary cursor-pointer hover:underline">+ 추가</span>}
        >
          {block.data.series.map((series) => (
            <div
              key={series.id}
              className="flex items-center justify-between py-1.5 px-2 bg-background border border-border rounded mb-1.5 last:mb-0"
            >
              <div>
                <div className="text-xs font-medium text-foreground">{series.name}</div>
                <div className="text-[10px] text-muted-foreground">집계: 합계</div>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive text-[10px]"
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="xs"
            className="w-full border-dashed text-[10px] text-primary hover:border-primary hover:bg-primary/5 mt-1"
          >
            + 시리즈 추가
          </Button>
        </SidebarSection>
      )}
    </div>
  );
}

function SidebarStyleTab({
  block,
  onStyleChange,
}: Pick<ChartBlockSidebarProps, "block" | "onStyleChange">) {
  const style = block.style;
  const legendPos = style.legend?.position ?? "bottom";
  const showLegend = legendPos !== "none";
  const showTooltip = style.tooltip?.shared !== false;
  const colors = style.colorPalette ?? DEFAULT_COLORS;

  const updateStyle = (patch: Partial<ChartStyle>) => {
    onStyleChange({ ...style, ...patch });
  };

  return (
    <div className="flex flex-col">
      <StyleAccordion title="색상" defaultOpen>
        <div className="flex flex-wrap gap-1.5">
          {colors.map((color, index) => (
            <div
              key={index}
              className="w-6 h-6 rounded cursor-pointer border-2 border-transparent hover:scale-110 transition-transform"
              style={{ background: color }}
              title={color}
            />
          ))}
        </div>
      </StyleAccordion>

      <StyleAccordion
        title="범례"
        toggle={showLegend}
        onToggle={(value) => updateStyle({ legend: { position: value ? "bottom" : "none" } })}
      >
        {showLegend && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">위치</span>
            <Select
              value={legendPos}
              onValueChange={(value) =>
                updateStyle({ legend: { position: value as "top" | "bottom" | "left" | "right" } })
              }
            >
              <SelectTrigger size="sm" className="min-w-[70px] text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom">아래</SelectItem>
                <SelectItem value="top">위</SelectItem>
                <SelectItem value="left">왼쪽</SelectItem>
                <SelectItem value="right">오른쪽</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </StyleAccordion>

      <StyleAccordion
        title="툴팁"
        toggle={showTooltip}
        onToggle={(value) => updateStyle({ tooltip: { shared: value } })}
      />

      <StyleAccordion
        title="데이터 레이블"
        toggle={false}
        onToggle={() => { }}
      />
    </div>
  );
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {action}
      </div>
      <div className="px-3 pb-2.5">
        {children}
      </div>
    </div>
  );
}

function StyleAccordion({
  title,
  toggle,
  onToggle,
  defaultOpen = true,
  children,
}: {
  title: string;
  toggle?: boolean;
  onToggle?: (value: boolean) => void;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasToggle = toggle !== undefined;

  return (
    <div className="border-b border-border">
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => !hasToggle && setOpen((prev) => !prev)}
      >
        <span className="text-xs font-medium text-foreground">{title}</span>
        {hasToggle ? (
          <label className="relative inline-block w-7 h-3.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={toggle}
              onChange={(e) => onToggle?.(e.target.checked)}
              className="sr-only peer"
            />
            <span className="absolute inset-0 rounded-full bg-background border border-border transition-colors peer-checked:bg-primary peer-checked:border-primary" />
            <span className="absolute left-0.5 top-[2px] w-2.5 h-2.5 rounded-full bg-muted-foreground transition-transform peer-checked:translate-x-3 peer-checked:bg-primary-foreground" />
          </label>
        ) : (
          <svg
            className={cn("w-2.5 h-2.5 text-muted-foreground transition-transform", !open && "-rotate-90")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>
      {((hasToggle && toggle) || (!hasToggle && open)) && children && (
        <div className="px-3 pb-2.5">
          {children}
        </div>
      )}
    </div>
  );
}
