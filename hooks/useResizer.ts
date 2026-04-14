"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizerOptions {
  direction: "horizontal";
  minLeft?: number;
  minRight?: number;
  initialRightWidth?: number;
}

export function useResizer({
  minLeft = 400,
  minRight = 280,
  initialRightWidth = 350,
}: UseResizerOptions) {
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isCollapsed) {
        setIsCollapsed(false);
        setRightWidth(initialRightWidth);
        return;
      }
      setIsDragging(true);
    },
    [isCollapsed, initialRightWidth]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newRightWidth = containerRect.right - e.clientX;

      if (newRightWidth < 100) {
        setIsCollapsed(true);
        setRightWidth(0);
        setIsDragging(false);
        return;
      }

      const clampedRight = Math.max(
        minRight,
        Math.min(newRightWidth, containerRect.width - minLeft)
      );
      setRightWidth(clampedRight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, minLeft, minRight]);

  return {
    rightWidth,
    isDragging,
    isCollapsed,
    containerRef,
    handleMouseDown,
  };
}
