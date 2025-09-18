"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  Send,
  Mic,
  ImageIcon,
  Bot,
  User,
  LayoutDashboard,
  Calculator,
} from "lucide-react"
import { useState } from "react"
import { VoiceRecorder } from "@/components/voice-recorder"
import { ChartGenerator } from "@/components/chart-generator"
import Link from "next/link"

export default function WealthAdvisorChat() {
  const [input, setInput] = useState("")
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [showChartGenerator, setShowChartGenerator] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { messages, sendMessage, status } = useChat({
    api: "/api/chat",
    onError: (error) => {
      console.log("[v0] Chat error:", JSON.stringify(error, null, 2))
      if (error.message) {
        setError(error.message)
      } else if (typeof error === "object" && error !== null) {
        setError("An error occurred while processing your request. Please try again.")
      } else {
        setError(String(error))
      }
    },
    onResponse: (response) => {
      console.log("[v0] Chat response received:", response.status)
      setError(null)
    },
    onFinish: (message) => {
      console.log("[v0] Chat message finished:", JSON.stringify(message, null, 2))
    },
  })

  const isLoading = status === "in_progress"

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Form submitted with input:", input)
    setError(null)
    if (input && input.trim()) {
      sendMessage({ text: input })
      setInput("")
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleVoiceRecordingComplete = (audioBlob: Blob, transcript?: string) => {
    console.log("[v0] Voice recording completed:", transcript)
    if (transcript) {
      setInput(`[Voice Message] ${transcript}`)
    }
    setShowVoiceRecorder(false)
  }

  const handleChartGenerated = (chartUrl: string, title: string) => {
    console.log("[v0] Chart generated:", title)
    setInput(`I've generated a chart: "${title}". Here's the visualization of your financial data.`)
    setShowChartGenerator(false)
  }

  const handleQuickAction = (message: string) => {
    console.log("[v0] Quick action triggered:", message)
    setInput(message)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">WealthAI</h1>
                <p className="text-sm text-muted-foreground">Your Personal Wealth Advisor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Badge variant="secondary" className="text-xs">
                <div className="w-2 h-2 bg-chart-1 rounded-full mr-1" />
                Active Session
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Quick Stats Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-chart-1" />
                    <span className="text-sm">Total Value</span>
                  </div>
                  <span className="font-semibold text-foreground">$2.4M</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-chart-1" />
                    <span className="text-sm">YTD Return</span>
                  </div>
                  <span className="font-semibold text-chart-1">+12.4%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-chart-2" />
                    <span className="text-sm">Risk Score</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Moderate
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-transparent"
                  onClick={() => handleQuickAction("Show me my portfolio allocation")}
                >
                  <PieChart className="w-4 h-4 mr-2" />
                  Portfolio Analysis
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-transparent"
                  onClick={() => handleQuickAction("What are the market trends today?")}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Market Insights
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-transparent"
                  onClick={() => setShowChartGenerator(true)}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Generate Chart
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    View Dashboard
                  </Button>
                </Link>
                <Link href="/tools">
                  <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                    <Calculator className="w-4 h-4 mr-2" />
                    Financial Tools
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[calc(100vh-200px)] flex flex-col">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg font-medium">AI Wealth Advisor Chat</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ask me anything about your investments, market analysis, or financial planning
                </p>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-0">
                <div className="p-6 space-y-4">
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-destructive rounded-full" />
                        <span className="text-sm font-medium text-destructive">Error</span>
                      </div>
                      <p className="text-sm text-destructive mt-1">{error}</p>
                      {error.includes("quota") && (
                        <p className="text-xs text-muted-foreground mt-2">
                          This appears to be an OpenAI API quota issue. Please check your API billing settings.
                        </p>
                      )}
                    </div>
                  )}

                  {messages.length === 0 && !error && (
                    <div className="text-center py-12">
                      <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Welcome to WealthAI</h3>
                      <p className="text-muted-foreground max-w-md mx-auto text-balance">
                        I'm your personal wealth advisor. Ask me about portfolio optimization, market analysis, risk
                        assessment, or any financial planning questions.
                      </p>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <Avatar className="w-8 h-8 bg-primary">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <Bot className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground ml-12"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>

                      {message.role === "user" && (
                        <Avatar className="w-8 h-8 bg-secondary">
                          <AvatarFallback className="bg-secondary text-secondary-foreground">
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="w-8 h-8 bg-primary">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                            <div
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            />
                            <div
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">Analyzing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Input Form */}
              <div className="border-t border-border p-4">
                {showChartGenerator && (
                  <div className="mb-4">
                    <ChartGenerator
                      onChartGenerated={handleChartGenerated}
                      onClose={() => setShowChartGenerator(false)}
                    />
                  </div>
                )}

                {showVoiceRecorder && (
                  <div className="mb-4">
                    <VoiceRecorder
                      onRecordingComplete={handleVoiceRecordingComplete}
                      onClose={() => setShowVoiceRecorder(false)}
                    />
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={input}
                      onChange={handleInputChange}
                      placeholder="Ask about your portfolio, market trends, or financial planning..."
                      className="pr-20"
                      disabled={isLoading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={`w-8 h-8 p-0 ${showVoiceRecorder ? "text-destructive" : "text-muted-foreground"}`}
                        onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                      >
                        <Mic className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={`w-8 h-8 p-0 ${showChartGenerator ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setShowChartGenerator(!showChartGenerator)}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" disabled={!input.trim() || isLoading} className="px-4">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Use voice memos, generate charts, or type your financial questions
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
