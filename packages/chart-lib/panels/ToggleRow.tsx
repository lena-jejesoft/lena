"use client"

import { cn } from "@/lib/utils"

export function ToggleSwitch({
  checked,
  disabled,
  onChange,
  size = "default",
}: {
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  size?: "default" | "sm"
}) {
  const isSmall = size === "sm"
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors",
        isSmall
          ? "h-[11px] w-[21px] min-h-[11px] min-w-[21px]"
          : "h-[18px] w-[32px] min-h-[18px] min-w-[32px]",
        checked ? "bg-primary/60" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute rounded-full bg-background transition-transform",
          isSmall
            ? "top-[1.5px] left-[1.5px] h-[8px] w-[8px]"
            : "top-[2px] left-[2px] h-[14px] w-[14px]",
          checked && (isSmall ? "translate-x-[10px]" : "translate-x-[14px]")
        )}
      />
    </button>
  )
}

export function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="space-y-1 min-w-0 flex-1">
        <p className="text-sm font-medium leading-none">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <ToggleSwitch checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}
