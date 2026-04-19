"use client";

import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

interface TruncatedTitleProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "title" | "children"> {
  /** Full text used as the `title` tooltip when the rendered span overflows horizontally. */
  text: string;
  /** Visible content. Defaults to `text`. Supply JSX when the display differs (e.g., appended badge). */
  children?: ReactNode;
}

/**
 * `<span>` that attaches `title={text}` only when its own horizontal content overflows
 * (`scrollWidth > clientWidth`). Short strings that fit in the available width render
 * without a tooltip, eliminating noisy hover tooltips on non-truncated labels.
 *
 * Measures once after mount and re-measures on element resize via `ResizeObserver`.
 * Apply the same truncation classes (e.g. `truncate`) to this component as you would to
 * a plain `<span>`; callers retain all other span attributes via spread.
 */
export function TruncatedTitle({ text, children, ...rest }: TruncatedTitleProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, children]);

  return (
    <span ref={ref} {...rest} title={overflow ? text : undefined}>
      {children ?? text}
    </span>
  );
}
