"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface SourcesProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface SourcesTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  count?: number
}

interface SourcesContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface SourceProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  title?: string
  children?: React.ReactNode
}

const Sources = React.forwardRef<HTMLDivElement, SourcesProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Sources.displayName = "Sources"

const SourcesTrigger = React.forwardRef<HTMLButtonElement, SourcesTriggerProps>(
  ({ className, count = 0, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)

    if (count === 0) return null

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            size="sm"
            className={cn(
              "flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground",
              className
            )}
            {...props}
          >
            <ExternalLink className="h-3 w-3" />
            Used {count} source{count !== 1 ? 's' : ''}
            {isOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {children}
        </CollapsibleContent>
      </Collapsible>
    )
  }
)
SourcesTrigger.displayName = "SourcesTrigger"

const SourcesContent = React.forwardRef<HTMLDivElement, SourcesContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-2", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SourcesContent.displayName = "SourcesContent"

const Source = React.forwardRef<HTMLAnchorElement, SourceProps>(
  ({ className, href, title, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-2 p-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors",
          className
        )}
        {...props}
      >
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">
          {title || children || href}
        </span>
      </a>
    )
  }
)
Source.displayName = "Source"

export { Sources, SourcesTrigger, SourcesContent, Source }
