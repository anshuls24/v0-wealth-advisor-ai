"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ImageIcon, Download, X, Loader2 } from "lucide-react"

interface ChartGeneratorProps {
  onChartGenerated: (chartUrl: string, title: string) => void
  onClose: () => void
}

export function ChartGenerator({ onChartGenerated, onClose }: ChartGeneratorProps) {
  const [chartType, setChartType] = useState("")
  const [title, setTitle] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedChart, setGeneratedChart] = useState<{
    url: string
    title: string
    type: string
  } | null>(null)

  const chartTypes = [
    { value: "portfolio-allocation", label: "Portfolio Allocation" },
    { value: "performance-trend", label: "Performance Trend" },
    { value: "risk-analysis", label: "Risk Analysis" },
    { value: "sector-breakdown", label: "Sector Breakdown" },
    { value: "asset-comparison", label: "Asset Comparison" },
    { value: "dividend-yield", label: "Dividend Yield Analysis" },
  ]

  const handleGenerate = async () => {
    if (!chartType || !title) return

    setIsGenerating(true)
    try {
      const response = await fetch("/api/generate-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartType,
          title,
          data: {}, // In real app, this would contain actual portfolio data
        }),
      })

      const result = await response.json()
      if (result.success) {
        setGeneratedChart({
          url: result.chartUrl,
          title: result.title,
          type: result.chartType,
        })
      }
    } catch (error) {
      console.error("Failed to generate chart:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUseChart = () => {
    if (generatedChart) {
      onChartGenerated(generatedChart.url, generatedChart.title)
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Generate Financial Chart</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {!generatedChart ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="chart-type">Chart Type</Label>
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chart type" />
                </SelectTrigger>
                <SelectContent>
                  {chartTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chart-title">Chart Title</Label>
              <Input
                id="chart-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q4 2024 Portfolio Performance"
              />
            </div>

            <Button onClick={handleGenerate} disabled={!chartType || !title || isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Chart...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Generate Chart
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Charts are generated based on your portfolio data</p>
              <p>• Generated charts can be downloaded or shared in chat</p>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <Badge variant="secondary" className="mb-2">
                Chart Generated
              </Badge>
              <h3 className="font-medium text-foreground">{generatedChart.title}</h3>
              <p className="text-sm text-muted-foreground capitalize">{generatedChart.type.replace("-", " ")}</p>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <img
                src={generatedChart.url || "/placeholder.svg"}
                alt={generatedChart.title}
                className="w-full h-48 object-cover bg-muted"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button size="sm" className="flex-1" onClick={handleUseChart}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Use in Chat
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setGeneratedChart(null)
                setChartType("")
                setTitle("")
              }}
            >
              Generate Another Chart
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
