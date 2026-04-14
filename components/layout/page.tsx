import * as React from "react"

import { cn } from "@/lib/utils"

function Page({
  className,
  direction = "vertical",
  ...props
}: React.ComponentProps<"div"> & {
  direction?: "vertical" | "horizontal"
}) {
  return (
    <div
      data-slot="page"
      className={cn(
        "flex h-full overflow-hidden bg-background",
        direction === "vertical" ? "flex-col" : "flex-row",
        className
      )}
      {...props}
    />
  )
}

function PageHeader({
  className,
  title,
  description,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  title?: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <div
      data-slot="page-header"
      className={cn("pt-10 px-6 pb-5 border-b border-border shrink-0", className)}
      {...props}
    >
      {title && (
        <h1 data-slot="page-title" className="text-xl font-medium text-foreground">
          {title}
        </h1>
      )}
      {description && (
        <p data-slot="page-description" className="text-[13px] text-muted-foreground mt-1">
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-body"
      className={cn("flex-1 overflow-y-auto p-4", className)}
      {...props}
    />
  )
}

function PageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-footer"
      className={cn(
        "shrink-0 border-t border-border px-6 py-4 flex items-center justify-end gap-2",
        className
      )}
      {...props}
    />
  )
}

export { Page, PageHeader, PageBody, PageFooter }
