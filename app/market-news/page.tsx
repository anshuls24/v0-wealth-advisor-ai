"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, TrendingUp, User, Bot, Newspaper, BarChart3, MessageSquare, LayoutDashboard } from "lucide-react"
import Link from "next/link"

export default function MarketNews() {
  const [input, setInput] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/market-news",
    }),
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Check if user has scrolled up to show scroll indicator
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollIndicator(scrollTop < scrollHeight - clientHeight - 100)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status === "streaming" || status === "submitted") return

    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Market Updates & News</h1>
                <p className="text-sm text-slate-600">Stay informed with real-time market analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat Advisor
                </Button>
              </Link>
              <Link href="/tools">
                <Button variant="outline" size="sm">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Financial Tools
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              MarketAI News
            </h1>
            <p className="text-slate-600 text-lg">
              Your AI-powered market intelligence and news assistant
            </p>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="news" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="news" className="flex items-center gap-2">
                <Newspaper className="h-4 w-4" />
                Market News Chat
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Market Analysis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="news" className="space-y-6">
              {/* Chat Interface */}
              <Card className="h-[600px] flex flex-col overflow-hidden">
                <CardHeader className="pb-4 flex-shrink-0 border-b bg-white">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Chat with MarketAI
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  {/* Messages Container */}
                  <div 
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto px-6 py-4 scroll-smooth bg-slate-50/50 relative"
                  >
                    {/* Scroll indicator */}
                    {showScrollIndicator && (
                      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
                        <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs shadow-lg">
                          ↑ Scroll up for more messages
                        </div>
                      </div>
                    )}
                    
                    {/* Scroll to bottom button */}
                    {showScrollIndicator && (
                      <div className="absolute bottom-4 right-4 z-10">
                        <Button
                          size="sm"
                          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                          className="rounded-full shadow-lg bg-green-600 hover:bg-green-700"
                        >
                          ↓
                        </Button>
                      </div>
                    )}
                    <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-slate-500 py-8">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation about market news and updates</p>
                        <p className="text-sm mt-2">
                          Ask about stocks, market trends, economic news, or sector analysis
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="bg-green-100 text-green-600">
                                <TrendingUp className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-3 break-words shadow-sm ${
                              message.role === "user"
                                ? "bg-green-600 text-white ml-auto"
                                : "bg-white border border-slate-200 text-slate-800"
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.parts
                                ?.filter((part: any) => part.type === 'text')
                                ?.map((part: any) => part.text)
                                ?.join('') || ''}
                            </p>
                          </div>
                          {message.role === "user" && (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="bg-slate-100 text-slate-600">
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      ))
                    )}
                    {status === "streaming" && (
                      <div className="flex gap-3 justify-start">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="bg-green-100 text-green-600">
                            <TrendingUp className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                            <span className="text-slate-600 text-sm">Analyzing market data...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Scroll target for auto-scrolling */}
                    <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Input Area - Fixed at bottom */}
                  <div className="border-t bg-white px-6 py-4 flex-shrink-0">
                    {/* Error Display */}
                    {(error || localError) && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">{error?.message || localError}</p>
                      </div>
                    )}

                    {/* Input Form */}
                    <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about market news, stock analysis, economic trends, or sector updates..."
                      className="flex-1"
                      disabled={status === "streaming" || status === "submitted"}
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim() || status === "streaming" || status === "submitted"}
                      className="px-6 bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Market Analysis Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        onClick={() => setInput("What are the current market trends and which sectors are performing well?")}
                        className="w-full"
                        variant="outline"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Market Trends Analysis
                      </Button>
                      
                      <Button
                        onClick={() => setInput("What are today's top market movers and breaking news?")}
                        className="w-full"
                        variant="outline"
                      >
                        <Newspaper className="h-4 w-4 mr-2" />
                        Breaking News
                      </Button>
                      
                      <Button
                        onClick={() => setInput("How are major indices performing today and what's driving the market?")}
                        className="w-full"
                        variant="outline"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Index Performance
                      </Button>
                      
                      <Button
                        onClick={() => setInput("What economic indicators should I watch this week?")}
                        className="w-full"
                        variant="outline"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Economic Calendar
                      </Button>
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 font-medium">💡 Quick Tips</p>
                      <p className="text-sm text-green-700 mt-1">
                        Try asking about specific stocks, sectors, or economic events. MarketAI can provide real-time analysis and context for your investment decisions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
