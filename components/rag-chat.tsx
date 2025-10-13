"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Bot, Loader2, Send, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface RAGChatProps {
  className?: string;
}

export function RAGChat({ className }: RAGChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [documentSources, setDocumentSources] = useState<any[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Use the AI SDK's useChat hook for automatic streaming
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/rag-chat' }),
    onFinish: (message) => {
      console.log('🔥 RAG Chat: Message finished:', message);
      console.log('🔥 RAG Chat: Message parts:', message.parts);
      
      setIsSearching(false); // Done searching
      
      // Extract sources from tool invocations in message parts
      if (message.parts && Array.isArray(message.parts)) {
        const toolParts = message.parts.filter(
          (part: any) => part.type === 'tool-result' || part.type === 'tool-invocation'
        );
        
        if (toolParts.length > 0) {
          console.log('🔥 RAG Chat: Tool parts found:', toolParts);
          
          for (const toolPart of toolParts) {
            console.log('🔥 RAG Chat: Processing tool part:', toolPart);
            
            // Check for tool result with sources
            const result = toolPart.result || toolPart.output;
            if (result) {
              console.log('🔥 RAG Chat: Tool result:', result);
              
              // Extract sources from result (AI SDK format - matching reference)
              if (result.sources && Array.isArray(result.sources)) {
                const sources = result.sources.map((source: any) => ({
                  id: source.id || source.sourceId,
                  title: source.title || "Knowledge Base Source",
                  url: source.url,
                  score: 0.9 // Default score for AI SDK sources
                }));
                console.log('🔥 RAG Chat: Extracted sources from result.sources:', sources);
                setDocumentSources(sources);
              }
              // Fallback: Try chatSources format (from VectorizeService)
              else if (result.chatSources && Array.isArray(result.chatSources)) {
                const sources = result.chatSources.map((source: any) => ({
                  id: source.id,
                  title: source.title,
                  url: source.url,
                  score: source.relevancy || 0.8
                }));
                console.log('🔥 RAG Chat: Extracted sources from result.chatSources:', sources);
                setDocumentSources(sources);
              }
            }
          }
        }
      }
    },
    onError: (error) => {
      console.error('🔥 RAG Chat: Error:', error);
      setIsSearching(false); // Stop searching on error
    }
  });

  // Watch for messages with tool invocations to show searching indicator
  useEffect(() => {
    if (status === "streaming") {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && latestMessage.role === 'assistant') {
        const hasToolInvocations = latestMessage.parts?.some((part: any) => part.type === 'tool-invocation');
        if (hasToolInvocations) {
          setIsSearching(true);
        }
      }
    }
  }, [messages, status]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || status === "streaming" || status === "submitted") return;
    
    console.log('🔥 RAG Chat: Sending message:', inputValue);
    
    setIsSearching(true); // Show searching indicator immediately
    setDocumentSources([]); // Clear previous sources
    sendMessage({ text: inputValue });
    setInputValue(''); // Clear input after sending
  }

  useEffect(() => {
    scrollToBottom()
    
    // Debug: Log all messages to see what's happening
    if (messages.length > 0) {
      console.log('🔥 RAG Chat: Total messages:', messages.length);
      messages.forEach((m, idx) => {
        console.log(`🔥 Message ${idx}:`, {
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
  }, [messages])

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "bg-green-100 text-green-800 border-green-300"
    if (score >= 0.8) return "bg-blue-100 text-blue-800 border-blue-300"
    if (score >= 0.7) return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-gray-100 text-gray-800 border-gray-300"
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  <div>
                    <div className="text-lg font-bold text-indigo-900">Document Search Assistant</div>
                    <div className="text-xs font-normal text-indigo-600">Search financial documents • Not a financial advisor</div>
                  </div>
                </CardTitle>
              </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 min-h-0">
            {/* Chat Messages */}
            <div className="lg:col-span-2 h-full p-4 bg-slate-50/50 overflow-y-auto">
              <div className="space-y-4">
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-slate-500">Messages: {messages.length} | Status: {status}</div>
                )}
                {messages.length === 0 && status === 'ready' && (
                  <div className="text-center text-slate-500 py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-indigo-400" />
                    <p className="mb-2 font-semibold text-slate-700">Search Financial Documents</p>
                    <p className="text-sm">Ask questions and I'll search our document library for answers.</p>
                    <div className="mt-4 text-xs text-slate-400 space-y-1">
                      <p>Try: "What is a Roth IRA?"</p>
                      <p>Try: "Explain dollar cost averaging"</p>
                    </div>
                  </div>
                )}

                {messages.map((m, idx) => {
                  // Check if message has tool invocations
                  const hasToolInvocations = m.parts?.some((part: any) => part.type === 'tool-invocation')
                  
                  // Get text content from parts
                  let textContent = '';
                  if (m.parts && Array.isArray(m.parts)) {
                    textContent = m.parts
                      .filter((part: any) => part.type === 'text')
                      .map((part: any) => part.text)
                      .join('');
                  }
                  
                  // Fallback: if no parts but has content property, use that
                  if (!textContent && m.content) {
                    textContent = typeof m.content === 'string' ? m.content : '';
                  }

                  // Debug mode: show empty messages in development
                  const isEmpty = !textContent && !hasToolInvocations;
                  if (process.env.NODE_ENV === 'development' && isEmpty && m.role === 'assistant') {
                    console.warn(`🔥 RAG Chat: Empty assistant message ${idx}:`, m);
                  }

                  // Don't render empty assistant messages (but always render user messages)
                  if (m.role === 'assistant' && isEmpty) {
                    return null;
                  }

                  return (
                    <div key={m.id} className="space-y-2">
                      {/* Debug info in development */}
                      {process.env.NODE_ENV === 'development' && (
                        <div className="text-xs text-slate-400 mb-1">
                          Msg {idx}: {m.role} | parts: {m.parts?.length || 0} | content: {m.content ? 'yes' : 'no'}
                        </div>
                      )}
                      
                      {/* Show tool invocations indicator */}
                      {hasToolInvocations && (
                        <div className="flex items-start gap-3 justify-start">
                          <div className="rounded-lg px-4 py-3 bg-blue-50 border border-blue-200 text-blue-800 animate-pulse">
                            <p className="text-sm flex items-center gap-2 font-medium">
                              <FileText className="h-4 w-4 animate-bounce" />
                              Retrieving documents...
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Main message - show if there's text content */}
                      {textContent && (
                        <div
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
                            <p className="text-sm whitespace-pre-wrap">
                              {textContent}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {/* Show searching indicator when actively searching */}
                {(status === "streaming" || isSearching) && (
                  <div className="flex items-start gap-3 justify-start">
                    <div className="rounded-lg px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 animate-pulse">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            {isSearching ? 'Searching documents...' : 'AI is thinking...'}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            This may take a few seconds
                          </p>
                        </div>
                      </div>
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
          {/* Status indicator */}
          {(status === "streaming" || isSearching) && (
            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {isSearching ? 'Searching documents and generating response...' : 'Processing your request...'}
              </p>
            </div>
          )}
          
          <form onSubmit={handleFormSubmit} className="flex gap-2">
            <Input
              name="message"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={
                status === "streaming" || status === "submitted"
                  ? "Searching documents..." 
                  : "Search financial documents... (e.g., 'What is a 401k?')"
              }
              className="flex-1"
              disabled={status === "streaming" || status === "submitted"}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || status === "streaming" || status === "submitted"}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
            >
              {status === "streaming" ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Processing</span>
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </form>
          {error && (
            <p className="text-red-500 text-sm mt-2">Error: {error.message}</p>
          )}
        </div>
      </Card>
    </div>
  )
}