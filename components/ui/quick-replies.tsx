"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

interface QuickReply {
  text: string
  value?: string
}

interface QuickRepliesProps {
  options: QuickReply[]
  onSelect: (value: string) => void
  disabled?: boolean
}

export function QuickReplies({ options, onSelect, disabled }: QuickRepliesProps) {
  if (!options || options.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 my-4">
      {options.map((option, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(option.value || option.text)}
          disabled={disabled}
          className="group hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all"
        >
          <span>{option.text}</span>
          <ArrowRight className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      ))}
    </div>
  )
}

