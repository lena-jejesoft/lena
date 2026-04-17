"use client";

import { cn } from "@/lib/utils";
import ChartBlockCardBody from "./chart-block-card-body";

export function ChartBlockCard({
  isActive,
  onActivate,
}: {
  isActive: boolean;
  onActivate: () => void;
}) {
  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden shrink-0 transition-all",
        isActive ? "border-primary/60 bg-card" : "border-border bg-card",
      )}
      onClick={onActivate}
    >
      <div className="flex flex-row w-full" style={{ minHeight: 300 }}>
        <div className="flex-1 min-w-0 w-full">
          <ChartBlockCardBody />
        </div>
      </div>
    </div>
  );
}
