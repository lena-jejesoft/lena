export type BlendedChartId = string | number;

export type BlendedLegendPosition = "top" | "bottom" | "left" | "right";

export interface BlendedChartViewState {
  showOutliers: boolean;
  showTooltip: boolean;
  showLegend: boolean;
  legendPosition: BlendedLegendPosition;
  seriesColors: Record<string, string>;
  groupColors: Record<string, string>;
}

export interface BlendedChartViewStoreState {
  byChartId: Record<string, BlendedChartViewState>;
}

export const DEFAULT_BLENDED_CHART_VIEW_STATE: Readonly<BlendedChartViewState> = Object.freeze({
  showOutliers: true,
  showTooltip: true,
  showLegend: true,
  legendPosition: "bottom",
  seriesColors: Object.freeze({}),
  groupColors: Object.freeze({}),
});
