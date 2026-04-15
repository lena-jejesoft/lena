"use client";

import type { ChartType, ChartStyle } from "./types";
import { CHART_TYPE_REGISTRY } from "./registry";
import { StyleTab } from "./StyleTab";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalClose,
} from "@/components/layout/modal";

interface ChartStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartType: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  availableChartTypes?: ChartType[];
  style: ChartStyle;
  onStyleChange: (style: ChartStyle) => void;
}

const selectClass =
  "w-full py-2 pr-7 pl-2.5 bg-[#2a2a2a] border border-[#444] rounded text-white text-xs font-light cursor-pointer appearance-none hover:border-[#666] hover:bg-[#333] focus:outline-none focus:border-[#666]";

export function ChartStyleModal({
  open,
  onOpenChange,
  chartType,
  onChartTypeChange,
  availableChartTypes,
  style,
  onStyleChange,
}: ChartStyleModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-sm">
        <ModalHeader className="flex flex-row items-center justify-between">
          <ModalTitle className="text-sm">차트 설정</ModalTitle>
          <ModalClose className="bg-transparent border-none text-muted-foreground cursor-pointer text-lg hover:text-white">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody className="p-0">
          {/* Chart type selector */}
          {onChartTypeChange && availableChartTypes && availableChartTypes.length > 1 && (
            <div className="p-4 pb-4 border-b border-[#2a2a2a]">
              <div className="text-[11px] font-medium text-[#999] mb-2.5">차트 유형</div>
              <div className="relative">
                <select
                  className={selectClass}
                  value={chartType}
                  onChange={(e) => onChartTypeChange(e.target.value as ChartType)}
                >
                  {availableChartTypes.map((t) => (
                    <option key={t} value={t}>
                      {CHART_TYPE_REGISTRY[t].label}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#888] pointer-events-none" />
              </div>
            </div>
          )}

          {/* Style options */}
          <StyleTab
            chartType={chartType}
            style={style}
            onStyleChange={onStyleChange}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
