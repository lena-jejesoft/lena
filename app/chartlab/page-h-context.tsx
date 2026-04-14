"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { BlendedChartViewStoreState } from "./page-h-types";
import { useBlendedChartViewStore, type UseBlendedChartViewStoreResult } from "./page-h-state";

const BlendedChartViewContext = createContext<UseBlendedChartViewStoreResult | null>(null);

interface BlendedChartViewProviderProps {
  children: ReactNode;
  initialState?: Partial<BlendedChartViewStoreState>;
}

export function BlendedChartViewProvider({ children, initialState }: BlendedChartViewProviderProps) {
  const store = useBlendedChartViewStore(initialState);

  return (
    <BlendedChartViewContext.Provider value={store}>
      {children}
    </BlendedChartViewContext.Provider>
  );
}

export function useBlendedChartViewContext(): UseBlendedChartViewStoreResult {
  const context = useContext(BlendedChartViewContext);
  if (!context) {
    throw new Error("useBlendedChartViewContext must be used inside BlendedChartViewProvider");
  }
  return context;
}

