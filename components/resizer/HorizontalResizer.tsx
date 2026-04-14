"use client";

import { cn } from "@/lib/utils";

interface HorizontalResizerProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isCollapsed: boolean;
  isDragging?: boolean;
}

export function HorizontalResizer({
  onMouseDown,
  isCollapsed,
  isDragging,
}: HorizontalResizerProps) {
  return (
    <div
      className={cn(
        "w-[5px] cursor-col-resize bg-border transition-colors shrink-0 relative",
        "hover:bg-primary/50",
        isDragging && "bg-primary",
        isCollapsed && "cursor-pointer"
      )}
      onMouseDown={onMouseDown}
    >
      {isCollapsed && (
        <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-primary text-[10px] pointer-events-none">
          ◀
        </span>
      )}
    </div>
  );
}
