"use client"

import { useRef, useEffect, useState } from "react"
import { Bot, Loader2, Send, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface RAGChatProps {
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export function RAGChat({ className }: RAGChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [documentSources, setDocumentSources] = useState<any[]>([])
  const [text, setText] = useState("")

  // Custom send message function that bypasses useChat completely
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    console.log('🔥 RAG Chat: Sending message:', content);
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setDocumentSources([]);

    try {
      const response = await fetch("/api/rag-chat", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client': 'rag-isolated',
          'X-Force-RAG': 'true'
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      console.log('🔥 RAG Chat: Got response:', response.status, response.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract document sources from headers
      const sourcesHeader = response.headers.get('X-Document-Sources');
      console.log('🔥 RAG Chat: Sources header:', sourcesHeader);
      if (sourcesHeader) {
        try {
          const sources = JSON.parse(sourcesHeader);
          console.log('🔥 RAG Chat: Parsed sources:', sources);
          setDocumentSources(sources);
        } catch (err) {
          console.error('Failed to parse document sources:', err);
        }
      } else {
        console.log('🔥 RAG Chat: No sources header found');
        setDocumentSources([]);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        createdAt: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          console.log('🔥 RAG Chat: Received chunk:', chunk);
          
          // Handle different streaming formats
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              // Handle AI SDK streaming format: data: {"type":"text-delta","delta":"content"}
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6); // Remove 'data: ' prefix
                const data = JSON.parse(jsonStr);
                
                if (data.type === 'text-delta' && data.delta) {
                  assistantContent += data.delta;
                  console.log('🔥 RAG Chat: Updated content:', assistantContent);
                  setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                      ? { ...m, content: assistantContent }
                      : m
                  ));
                }
              } 
              // Handle other AI SDK formats
              else if (line.startsWith('0:') || line.startsWith('{"')) {
                const jsonStr = line.startsWith('0:') ? line.slice(2) : line;
                const data = JSON.parse(jsonStr);
                
                if (data.content) {
                  assistantContent += data.content;
                } else if (data.message) {
                  assistantContent = data.message;
                } else if (typeof data === 'string') {
                  assistantContent += data;
                }
                
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessage.id 
                    ? { ...m, content: assistantContent }
                    : m
                ));
              }
            } catch (e) {
              console.log('🔥 RAG Chat: Could not parse line as JSON:', line);
              // Skip unparseable lines
            }
          }
        }
      }

      console.log('🔥 RAG Chat: Final assistant content:', assistantContent);
      console.log('🔥 RAG Chat: Final messages state:', messages);

    } catch (err) {
      console.error('🔥 RAG Chat Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const sanitizeAssistantContent = (raw: string): string => {
    if (!raw) return raw
    
    console.log('🔥 RAG Chat: Raw AI response:', raw);
    
    // Temporarily disable sanitization to debug
    return raw;
    
    // const banned = [
    //   /financial profile/i,
    //   /profile summary/i,
    //   /sidebar/i,
    //   /complete (your )?financial profile/i,
    //   /(before we|to get started).*gather/i,
    //   /speaking of goals/i,
    //   /would you like to (explore|discuss|talk about).*goals?/i,
    //   /tailor (?:a )?plan for you/i,
    //   /what are your .*goals?/i,
    //   /(could|would) you .* (share|tell).*goals?/i,
    //   /your (short|medium|long)[- ]term.*goals?/i,
    //   /(short|medium|long)[- ]term (financial )?(objectives|goals)/i,
    //   /onboard|onboarding/i,
    // ]

    // // Remove only offending sentences/lines instead of blanketing the whole reply
    // const parts = raw
    //   .split(/(?<=[\.!?])\s+|\n+/)
    //   .filter(Boolean)
    //   .filter((segment) => !banned.some((r) => r.test(segment)))

    // if (parts.length === 0) {
    //   return "Ask a question about your documents and I'll retrieve relevant information and cite sources."
    // }
    // return parts.join(' ')
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || isLoading) return
    
    sendMessage(text)
    setText("")
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "bg-green-100 text-green-800 border-green-300"
    if (score >= 0.8) return "bg-blue-100 text-blue-800 border-blue-300"
    if (score >= 0.7) return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-gray-100 text-gray-800 border-gray-300"
  }

  useEffect(() => {
    // Extract sources from the latest assistant message
    const latestAssistantMessage = messages
      .filter(msg => msg.role === 'assistant' && msg.data?.sources)
      .pop()

    if (latestAssistantMessage && latestAssistantMessage.data?.sources) {
      setDocumentSources(latestAssistantMessage.data.sources)
    } else {
      setDocumentSources([])
    }
  }, [messages])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI-RAG Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 min-h-0">
            {/* Chat Messages */}
            <div className="lg:col-span-2 h-full p-4 bg-slate-50/50 overflow-y-auto">
              <div className="space-y-4">
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-slate-500">Messages: {messages.length} | Loading: {isLoading ? 'yes' : 'no'}</div>
                )}
                {messages.length === 0 && !isLoading && (
                  <div className="text-center text-slate-500 py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">Ask me anything about your financial documents!</p>
                    <p className="text-sm">I'll retrieve relevant information to provide accurate answers.</p>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`rounded-lg px-4 py-2 max-w-[70%] ${
                        m.role === "user"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">
                        {(() => {
                          const raw =
                            m.content ??
                            // @ts-expect-error: UIMessage data shape may include parts
                            (m.parts?.filter((p: any) => p?.type === 'text')?.map((p: any) => p.text).join('') ?? '')
                          return m.role === 'assistant' ? sanitizeAssistantContent(raw) : raw
                        })()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start gap-3 justify-start">
                    <div className="rounded-lg px-4 py-2 max-w-[70%] bg-gray-200 text-gray-800">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Document Sources */}
            <div className="lg:col-span-1 h-full border-l p-4 bg-white overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Document Sources
              </h3>
              {documentSources.length === 0 ? (
                <p className="text-sm text-gray-500">No documents retrieved for this query.</p>
              ) : (
                <div className="space-y-3">
                  {documentSources.map((source, index) => (
                    <div
                      key={source.id || index}
                      className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <h4 className="text-sm font-medium text-gray-800">{source.title || `Document ${index + 1}`}</h4>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 block"
                        >
                          {source.url}
                        </a>
                      )}
                      {source.score !== undefined && (
                        <Badge className={`mt-2 ${getScoreColor(source.score)}`}>
                          Relevance: {(source.score * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <div className="border-t p-4 bg-white flex-shrink-0">
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!text.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </form>
          {error && (
            <p className="text-red-500 text-sm mt-2">Error: {error}</p>
          )}
        </div>
      </Card>
    </div>
  )
}