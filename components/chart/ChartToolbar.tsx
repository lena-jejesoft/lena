"use client";

import { useState } from "react";
import type { ChartType, ChartStyle } from "./types";
import { ChartStyleModal } from "./ChartStyleModal";

interface ChartToolbarProps {
  title?: string;
  chartType: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  availableChartTypes?: ChartType[];
  style: ChartStyle;
  onStyleChange: (style: ChartStyle) => void;
  children?: React.ReactNode;
}

export function ChartToolbar({
  title,
  chartType,
  onChartTypeChange,
  availableChartTypes,
  style,
  onStyleChange,
  children,
}: ChartToolbarProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
        {title ? (
          <span className="text-[11px] text-[#999] font-medium truncate">{title}</span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          {children}
          <button
            className="bg-transparent border-none text-muted-foreground cursor-pointer p-1 rounded hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setModalOpen(true)}
            title="차트 설정"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <ChartStyleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        chartType={chartType}
        onChartTypeChange={onChartTypeChange}
        availableChartTypes={availableChartTypes}
        style={style}
        onStyleChange={onStyleChange}
      />
    </>
  );
}
