import * as React from "react"

import { cn } from "@/lib/utils"

function Panel({
  className,
  variant = "flex",
  bordered = false,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "flex" | "fixed"
  bordered?: boolean
}) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "flex flex-col overflow-hidden",
        variant === "flex" && "flex-1 min-w-0",
        bordered && "border-r border-border",
        className
      )}
      {...props}
    />
  )
}

function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "p-4 border-b border-border shrink-0 flex items-center justify-between",
        className
      )}
      {...props}
    />
  )
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-body"
      className={cn("flex-1 overflow-y-auto p-4", className)}
      {...props}
    />
  )
}

function PanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-footer"
      className={cn(
        "shrink-0 border-t border-border p-4 flex items-center justify-end gap-2",
        className
      )}
      {...props}
    />
  )
}

export { Panel, PanelHeader, PanelBody, PanelFooter }
