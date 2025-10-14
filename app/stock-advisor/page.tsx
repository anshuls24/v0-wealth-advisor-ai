"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  User,
  TrendingUp,
  LineChart,
  DollarSign,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function StockAdvisorPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Use the same pattern as RAG chat
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/stock-advisor' }),
    onFinish: (message) => {
      console.log('✅ Stock Advisor: Message finished:', message);
      console.log('✅ Stock Advisor: Message parts:', message.parts);
      console.log('✅ Stock Advisor: Message content:', message.content);
    },
    onError: (error) => {
      console.error('❌ Stock Advisor Error:', error);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Debug: Log all messages to see what's happening
    if (messages.length > 0) {
      console.log('📊 Stock Advisor: Total messages:', messages.length);
      messages.forEach((m, idx) => {
        console.log(`📊 Message ${idx}:`, {
          id: m.id,
          role: m.role,
          content: m.content,
          parts: m.parts,
          hasContent: !!m.content,
          hasParts: !!m.parts,
          partsLength: m.parts?.length || 0
        });
      });
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || status === "streaming" || status === "submitting") {
      return;
    }

    console.log("📤 Sending to Stock Advisor API:", inputValue);
    sendMessage({ text: inputValue });
    setInputValue('');
  };

  const isLoading = status === "streaming" || status === "submitting";

  // Quick action buttons
  const quickActions = [
    { label: "Market Overview", query: "What's happening in the market today?" },
    { label: "Analyze AAPL", query: "Analyze Apple stock (AAPL) - price, trend, and news" },
    { label: "Tech Sector", query: "What are the top tech stocks to watch?" },
    { label: "Trading Strategy", query: "Explain momentum trading strategy" },
  ];

  const handleQuickAction = (query: string) => {
    if (isLoading) return;
    console.log("📤 Quick Action - Sending to Stock Advisor API:", query);
    sendMessage({ text: query });
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <Card className="rounded-none border-b shadow-sm">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-xl">Stock Market Advisor</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time market analysis powered by Polygon.io
                </p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <div className={`w-2 h-2 rounded-full ${status === "ready" ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
              {status === "ready" ? "Connected" : "Processing..."}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center px-4">
            <div className="p-6 bg-blue-500/10 rounded-full">
              <LineChart className="w-16 h-16 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Welcome to Stock Market Advisor</h2>
              <p className="text-muted-foreground max-w-md">
                Get real-time stock data, technical analysis, fundamentals, news, and
                trading insights powered by AI
              </p>
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-2xl">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-3 text-left justify-start"
                  onClick={() => handleQuickAction(action.query)}
                  disabled={isLoading}
                >
                  <span className="text-sm">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // Extract text content from message parts (same as RAG chat)
              let textContent = '';
              if (message.parts && Array.isArray(message.parts)) {
                textContent = message.parts
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => part.text)
                  .join('');
              }
              
              // Fallback: use content property if no parts
              if (!textContent && message.content) {
                textContent = typeof message.content === 'string' ? message.content : '';
              }

              // Check if message has tool invocations
              const hasToolInvocations = message.parts?.some((part: any) => part.type === 'tool-invocation');

              // Skip empty assistant messages (but always show user messages)
              if (message.role === 'assistant' && !textContent && !hasToolInvocations) {
                return null;
              }

              return (
                <div key={message.id || index} className="space-y-2">
                  {/* Show tool invocations indicator */}
                  {hasToolInvocations && (
                    <div className="flex gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-muted">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <Card className="border-blue-200 bg-blue-50 max-w-[90%]">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 text-blue-800">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm font-medium">Fetching market data...</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Main message content */}
                  {textContent && (
                    <div
                      className={`flex gap-3 ${
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback
                          className={
                            message.role === "user"
                              ? "bg-blue-500 text-white"
                              : "bg-muted"
                          }
                        >
                          {message.role === "user" ? (
                            <User className="w-4 h-4" />
                          ) : (
                            <Bot className="w-4 h-4" />
                          )}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className={`flex-1 ${
                          message.role === "user" ? "flex justify-end" : ""
                        }`}
                      >
                        <Card
                          className={
                            message.role === "user"
                              ? "bg-blue-500 text-white border-blue-600 max-w-[80%]"
                              : "border-border max-w-[90%]"
                          }
                        >
                          <CardContent className="p-3">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {textContent}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-muted">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <Card className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Analyzing market data...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error.message}</span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <Card className="rounded-none border-t shadow-lg">
        <CardContent className="p-4">
          <form onSubmit={handleFormSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Ask about stocks, market trends, or trading strategies..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={!inputValue.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            <DollarSign className="w-3 h-3 inline mr-1" />
            Real-time data from Polygon.io • Analysis is not financial advice
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

