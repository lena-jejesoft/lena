"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  BlendedChartId,
  BlendedChartViewState,
  BlendedChartViewStoreState,
  BlendedLegendPosition,
} from "./page-h-types";
import { DEFAULT_BLENDED_CHART_VIEW_STATE } from "./page-h-types";

export const BLENDED_CHART_VIEW_STORAGE_KEY = "chartlab:blended-chart-view:v1";

const cloneDefaultChartViewState = (): BlendedChartViewState => ({
  showOutliers: DEFAULT_BLENDED_CHART_VIEW_STATE.showOutliers,
  showTooltip: DEFAULT_BLENDED_CHART_VIEW_STATE.showTooltip,
  showLegend: DEFAULT_BLENDED_CHART_VIEW_STATE.showLegend,
  legendPosition: DEFAULT_BLENDED_CHART_VIEW_STATE.legendPosition,
  seriesColors: {},
  groupColors: {},
});

const toChartKey = (chartId: BlendedChartId): string => String(chartId);

const normalizeChartViewState = (partial?: Partial<BlendedChartViewState>): BlendedChartViewState => ({
  ...cloneDefaultChartViewState(),
  ...partial,
  seriesColors: partial?.seriesColors ? { ...partial.seriesColors } : {},
  groupColors: partial?.groupColors ? { ...partial.groupColors } : {},
});

const upsertChartState = (
  prev: BlendedChartViewStoreState,
  chartId: BlendedChartId,
  updater: (current: BlendedChartViewState) => BlendedChartViewState
): BlendedChartViewStoreState => {
  const key = toChartKey(chartId);
  const current = prev.byChartId[key] ?? cloneDefaultChartViewState();
  const next = updater(current);
  if (next === current) return prev;
  return {
    byChartId: {
      ...prev.byChartId,
      [key]: next,
    },
  };
};

export const createBlendedChartViewStore = (
  initial?: Partial<BlendedChartViewStoreState>
): BlendedChartViewStoreState => {
  const next: BlendedChartViewStoreState = {
    byChartId: {},
  };
  const input = initial?.byChartId ?? {};
  for (const [chartId, state] of Object.entries(input)) {
    next.byChartId[chartId] = normalizeChartViewState(state);
  }
  return next;
};

export const serializeBlendedChartViewStore = (store: BlendedChartViewStoreState): string => {
  return JSON.stringify(store);
};

export const parseBlendedChartViewStore = (raw: string | null): BlendedChartViewStoreState => {
  if (!raw) return createBlendedChartViewStore();
  try {
    const parsed = JSON.parse(raw) as Partial<BlendedChartViewStoreState>;
    return createBlendedChartViewStore(parsed);
  } catch {
    return createBlendedChartViewStore();
  }
};

export interface UseBlendedChartViewStoreResult {
  store: BlendedChartViewStoreState;
  getChartState: (chartId: BlendedChartId) => BlendedChartViewState;
  ensureChartState: (chartId: BlendedChartId, seed?: Partial<BlendedChartViewState>) => void;
  patchChartState: (chartId: BlendedChartId, patch: Partial<BlendedChartViewState>) => void;
  setShowOutliers: (chartId: BlendedChartId, show: boolean) => void;
  setShowTooltip: (chartId: BlendedChartId, show: boolean) => void;
  setShowLegend: (chartId: BlendedChartId, show: boolean) => void;
  setLegendPosition: (chartId: BlendedChartId, position: BlendedLegendPosition) => void;
  setSeriesColor: (chartId: BlendedChartId, seriesId: string, color: string) => void;
  removeSeriesColor: (chartId: BlendedChartId, seriesId: string) => void;
  setGroupColor: (chartId: BlendedChartId, groupId: string, color: string) => void;
  removeGroupColor: (chartId: BlendedChartId, groupId: string) => void;
  resetChartState: (chartId: BlendedChartId) => void;
}

export const useBlendedChartViewStore = (
  initial?: Partial<BlendedChartViewStoreState>
): UseBlendedChartViewStoreResult => {
  const [store, setStore] = useState<BlendedChartViewStoreState>(() => createBlendedChartViewStore(initial));

  const getChartState = useCallback(
    (chartId: BlendedChartId): BlendedChartViewState => {
      return store.byChartId[toChartKey(chartId)] ?? cloneDefaultChartViewState();
    },
    [store]
  );

  const ensureChartState = useCallback((chartId: BlendedChartId, seed?: Partial<BlendedChartViewState>) => {
    setStore((prev) => {
      const key = toChartKey(chartId);
      if (prev.byChartId[key]) return prev;
      return {
        byChartId: {
          ...prev.byChartId,
          [key]: normalizeChartViewState(seed),
        },
      };
    });
  }, []);

  const patchChartState = useCallback((chartId: BlendedChartId, patch: Partial<BlendedChartViewState>) => {
    setStore((prev) =>
      upsertChartState(prev, chartId, (current) =>
        normalizeChartViewState({
          ...current,
          ...patch,
          seriesColors: patch.seriesColors ? { ...current.seriesColors, ...patch.seriesColors } : current.seriesColors,
          groupColors: patch.groupColors ? { ...current.groupColors, ...patch.groupColors } : current.groupColors,
        })
      )
    );
  }, []);

  const setShowOutliers = useCallback((chartId: BlendedChartId, show: boolean) => {
    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (current.showOutliers === show) return current;
        return { ...current, showOutliers: show };
      })
    );
  }, []);

  const setShowTooltip = useCallback((chartId: BlendedChartId, show: boolean) => {
    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (current.showTooltip === show) return current;
        return { ...current, showTooltip: show };
      })
    );
  }, []);

  const setShowLegend = useCallback((chartId: BlendedChartId, show: boolean) => {
    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (current.showLegend === show) return current;
        return { ...current, showLegend: show };
      })
    );
  }, []);

  const setLegendPosition = useCallback((chartId: BlendedChartId, position: BlendedLegendPosition) => {
    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (current.legendPosition === position) return current;
        return { ...current, legendPosition: position };
      })
    );
  }, []);

  const setSeriesColor = useCallback((chartId: BlendedChartId, seriesId: string, color: string) => {
    const trimmed = color.trim();
    if (!seriesId || !trimmed) return;

    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (current.seriesColors[seriesId] === trimmed) return current;
        return {
          ...current,
          seriesColors: {
            ...current.seriesColors,
            [seriesId]: trimmed,
          },
        };
      })
    );
  }, []);

  const removeSeriesColor = useCallback((chartId: BlendedChartId, seriesId: string) => {
    if (!seriesId) return;

    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (!current.seriesColors[seriesId]) return current;
        const nextColors = { ...current.seriesColors };
        delete nextColors[seriesId];
        return {
          ...current,
          seriesColors: nextColors,
        };
      })
    );
  }, []);

  const setGroupColor = useCallback((chartId: BlendedChartId, groupId: string, color: string) => {
    const trimmed = color.trim();
    if (!groupId || !trimmed) return;

    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (current.groupColors[groupId] === trimmed) return current;
        return {
          ...current,
          groupColors: {
            ...current.groupColors,
            [groupId]: trimmed,
          },
        };
      })
    );
  }, []);

  const removeGroupColor = useCallback((chartId: BlendedChartId, groupId: string) => {
    if (!groupId) return;

    setStore((prev) =>
      upsertChartState(prev, chartId, (current) => {
        if (!current.groupColors[groupId]) return current;
        const nextColors = { ...current.groupColors };
        delete nextColors[groupId];
        return {
          ...current,
          groupColors: nextColors,
        };
      })
    );
  }, []);

  const resetChartState = useCallback((chartId: BlendedChartId) => {
    setStore((prev) =>
      upsertChartState(prev, chartId, () => cloneDefaultChartViewState())
    );
  }, []);

  return useMemo(
    () => ({
      store,
      getChartState,
      ensureChartState,
      patchChartState,
      setShowOutliers,
      setShowTooltip,
      setShowLegend,
      setLegendPosition,
      setSeriesColor,
      removeSeriesColor,
      setGroupColor,
      removeGroupColor,
      resetChartState,
    }),
    [
      store,
      getChartState,
      ensureChartState,
      patchChartState,
      setShowOutliers,
      setShowTooltip,
      setShowLegend,
      setLegendPosition,
      setSeriesColor,
      removeSeriesColor,
      setGroupColor,
      removeGroupColor,
      resetChartState,
    ]
  );
};
