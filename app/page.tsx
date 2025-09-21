"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, Mic, MicOff, BarChart3, User, Bot, Calculator } from "lucide-react"
import { VoiceRecorder } from "@/components/voice-recorder"
import { ChartGenerator } from "@/components/chart-generator"

export default function Home() {
  const [input, setInput] = useState("")
  const [showChartGenerator, setShowChartGenerator] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/conversation",
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              WealthAI Advisor
            </h1>
            <p className="text-slate-600 text-lg">
              Your personal AI-powered wealth management assistant
            </p>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Chat Advisor
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Financial Tools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="space-y-6">
              {/* Chat Interface */}
              <Card className="h-[600px] flex flex-col overflow-hidden">
                <CardHeader className="pb-4 flex-shrink-0 border-b bg-white">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Chat with WealthAI
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
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs shadow-lg">
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
                          className="rounded-full shadow-lg"
                        >
                          ↓
                        </Button>
                      </div>
                    )}
                    <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-slate-500 py-8">
                        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation with your AI wealth advisor</p>
                        <p className="text-sm mt-2">
                          Ask about investments, portfolio optimization, or financial planning
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
                              <AvatarFallback className="bg-blue-100 text-blue-600">
                                <Bot className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-3 break-words shadow-sm ${
                              message.role === "user"
                                ? "bg-blue-600 text-white ml-auto"
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
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                            <span className="text-slate-600 text-sm">Thinking...</span>
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
                      placeholder="Ask about investments, portfolio optimization, or financial planning..."
                      className="flex-1"
                      disabled={status === "streaming" || status === "submitted"}
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim() || status === "streaming" || status === "submitted"}
                      className="px-6"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tools" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Financial Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        onClick={() => setShowChartGenerator(!showChartGenerator)}
                        className="w-full"
                        variant="outline"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Generate Financial Charts
                      </Button>
                      
                      <Button
                        onClick={() => window.open('/tools', '_blank')}
                        className="w-full"
                        variant="outline"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Advanced Financial Tools
                      </Button>
                    </div>
                    
                    {showChartGenerator && (
                      <div className="mt-4">
                        <ChartGenerator onChartGenerated={() => {}} onClose={() => setShowChartGenerator(false)} />
                      </div>
                    )}
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