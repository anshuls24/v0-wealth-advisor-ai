"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, Mic, MicOff, BarChart3, User, Bot, Calculator, TrendingUp, CheckCircle, Edit3, Database } from "lucide-react"
import { VoiceRecorder } from "@/components/voice-recorder"
import { ChartGenerator } from "@/components/chart-generator"
import { ProfileCompletionTracker } from "@/components/profile-completion-tracker"
import { RAGChat } from "@/components/rag-chat"
import { QuickReplies } from "@/components/ui/quick-replies"
import Link from "next/link"
import { ClientProfile, EMPTY_PROFILE, isProfileComplete, isProfileSufficientlyComplete, generateEditableProfileSummary, getProfileCompletionPercentage } from "@/lib/profile-schema"
import { extractProfileUpdates, applyProfileUpdates } from "@/lib/profile-extractor"
import { profileTracker, ProfileExtractionProgress } from "@/lib/real-time-profile-tracker"

// Simple user ID generation for session
function getUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// Parse quick reply buttons from message content
function parseQuickReplies(content: string): { text: string; buttons: string[] | null } {
  const buttonPattern = /\[BUTTONS:\s*([^\]]+)\]/gi  // Added 'g' flag to match all occurrences
  const match = content.match(buttonPattern)
  
  if (match && match.length > 0) {
    // Use the first match only
    const firstMatch = match[0]
    const buttonsText = firstMatch.replace(/\[BUTTONS:\s*/i, '').replace(/\]/g, '')
    const buttons = buttonsText.split('|').map(b => b.trim()).filter(b => b.length > 0)
    // Remove ALL button patterns from text
    const cleanText = content.replace(buttonPattern, '').trim()
    return { text: cleanText, buttons }
  }
  
  return { text: content, buttons: null }
}

// localStorage keys
const PROFILE_STORAGE_KEY = 'stockai_profile'
const USER_ID_STORAGE_KEY = 'stockai_user_id'

// localStorage helper functions
function saveProfileToStorage(profile: ClientProfile) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }
}

function loadProfileFromStorage(): ClientProfile {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (error) {
        console.error('Error parsing stored profile:', error)
      }
    }
  }
  return EMPTY_PROFILE
}

export default function Home() {
  const [showChartGenerator, setShowChartGenerator] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [profileExtractionProgress, setProfileExtractionProgress] = useState<ProfileExtractionProgress | null>(null)
  
  // Initialize profile from localStorage or empty profile
  const [profile, setProfile] = useState<ClientProfile>(() => {
    if (typeof window !== 'undefined') {
      return loadProfileFromStorage()
    }
    return EMPTY_PROFILE
  })
  
  // Use ref to maintain current profile state for API calls - initialize with the same value as profile state
  const profileRef = useRef<ClientProfile>(profile)
  
  const [showSummary, setShowSummary] = useState(false)
  const [profileConfirmed, setProfileConfirmed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Initialize userId with localStorage persistence
  const [userId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(USER_ID_STORAGE_KEY)
      if (stored) {
        return stored
      }
      const newUserId = getUserId()
      localStorage.setItem(USER_ID_STORAGE_KEY, newUserId)
      return newUserId
    }
    return 'temp-user-id'
  })

  const { messages, sendMessage, status, error } = useChat({
    id: "advisor",
    api: "/api/conversation",
    body: () => ({
      userId,
      profile, // Pass current profile to backend
    }),
    onFinish: async (message) => {
      console.log('🎯 onFinish called - simplified version')
      console.log('📊 Messages array length:', messages.length)
      console.log('📊 Unique message IDs:', new Set(messages.map(m => m.id)).size)
      
      // Simple client-side profile extraction
      if (messages.length > 0) {
        const latestUserMessage = messages[messages.length - 1];
        if (latestUserMessage?.role === 'user') {
          const userContent = latestUserMessage.content || '';
          
          if (userContent.trim().length > 0) {
            console.log('🔍 Processing user message:', userContent);
            
            const currentProfile = profile;
            const updates = extractProfileUpdates(userContent, currentProfile);
            
            if (updates.length > 0) {
              const updatedProfile = applyProfileUpdates(currentProfile, updates);
              setProfile(updatedProfile);
              profileRef.current = updatedProfile;
              saveProfileToStorage(updatedProfile);
              
              console.log('✅ Profile updated with', updates.length, 'changes');
            }
          }
        }
      }
    },
    onError: (error) => {
      console.error('❌ Chat error:', error);
    }
  })

  // Local submit to avoid any default endpoint quirks
  const [text, setText] = useState("")

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || status === "streaming" || status === "submitted") return
    sendMessage({ text })
    setText("")
  }

  // Initialize profile ref with current profile state
  useEffect(() => {
    profileRef.current = profile
  }, [profile])


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

  // Note: using handleSubmit from useChat

  // Debug chat status
  useEffect(() => {
    console.log('💬 Chat Status Changed:', { status, error, messagesCount: messages.length })
  }, [status, error, messages.length])

  const handleConfirmProfile = () => {
    setProfileConfirmed(true)
    setShowSummary(false)
    sendMessage({ text: "I confirm that all the information in my financial profile is accurate and complete. Please provide my personalized investment recommendations." })
  }

  const handleEditProfile = () => {
    setShowSummary(false)
    sendMessage({ text: "I'd like to make some changes to my profile. Please help me update the information." })
  }

  const handleClearProfile = () => {
    setProfile(EMPTY_PROFILE)
    profileRef.current = EMPTY_PROFILE
    setProfileConfirmed(false)
    setShowSummary(false)
    saveProfileToStorage(EMPTY_PROFILE)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PROFILE_STORAGE_KEY)
    }
    console.log('🗑️ Profile cleared - starting fresh!')
  }

  const handleCheckProfile = () => {
    console.log('🔍 Check Profile button clicked!')
    console.log('🔍 Current React profile state:', JSON.stringify(profile, null, 2))
    console.log('🔍 Current profileRef:', JSON.stringify(profileRef.current, null, 2))
    console.log('🔍 localStorage profile:', localStorage.getItem(PROFILE_STORAGE_KEY))
    console.log('🔍 Profile completion percentage:', getProfileCompletionPercentage(profile))
  }

  const handleRefreshProfile = () => {
    console.log('🔄 Current profile state:', JSON.stringify(profile, null, 2))
    console.log('🔄 ProfileRef state:', JSON.stringify(profileRef.current, null, 2))
    console.log('✅ Profile state displayed')
  }

  const handleTestParseProfile = () => {
    console.log('🧪 Testing profile parsing...')
    const testUserMessage = "I want to buy a house in 5 years"
    console.log('📊 Current profile before test:', JSON.stringify(profile, null, 2))
    
    const updates = extractProfileUpdates(testUserMessage, profile)
    console.log('✅ Test profile updates extracted:', updates)
    
    if (updates.length > 0) {
      const updatedProfile = applyProfileUpdates(profile, updates)
      console.log('📈 Test updated profile:', JSON.stringify(updatedProfile, null, 2))
      
      // Apply the updates to the actual profile
      setProfile(updatedProfile)
      profileRef.current = updatedProfile
      saveProfileToStorage(updatedProfile)
      console.log('✅ Test profile updates applied')
    } else {
      console.log('❌ No updates found in test')
    }
  }

  const handleTestProfileUpdate = () => {
    console.log('🧪 Test Profile button clicked!')
    const testProfile = {
      goals: { short_term: 'test goal', medium_term: null, long_term: null },
      risk: { tolerance: 'moderate', history: null },
      financials: { income: null, assets: '100k', expenses: null },
      time_horizon: '5 years',
      preferences: ['stocks'],
      expectations: ['10%']
    }
    console.log('🧪 Testing profile update with:', JSON.stringify(testProfile, null, 2))
    setProfile(testProfile)
    profileRef.current = testProfile
    console.log('✅ Test profile set')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="container mx-auto px-4 py-4 flex-1 flex flex-col max-w-6xl">
        {/* Header - Always visible */}
        <div className="text-center mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            STOCK-AI Advisor
          </h1>
          <p className="text-slate-600 text-sm">
            Your personal AI-powered stock trading assistant
          </p>
            
            {/* Debug Section */}
          <div className="mt-2 flex justify-center gap-2 flex-wrap">
              <Button 
                onClick={handleCheckProfile}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                🔍 Check Profile
              </Button>
              <Button 
                onClick={handleRefreshProfile}
                variant="outline"
                size="sm"
                className="text-xs text-blue-600"
              >
                🔄 Refresh Profile
              </Button>
              <Button 
                onClick={handleTestProfileUpdate}
                variant="outline"
                size="sm"
                className="text-xs text-green-600"
              >
                🧪 Test Profile
              </Button>
              
              <Button 
                onClick={handleTestParseProfile}
                variant="outline"
                size="sm"
                className="text-xs text-purple-600"
              >
                🔍 Test Parse
              </Button>
              <Button 
                onClick={handleClearProfile}
                variant="outline"
                size="sm"
                className="text-xs text-red-600"
              >
                🗑️ Clear Profile
              </Button>
            </div>
          </div>

        {/* Main Content - Fixed height container */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs defaultValue="chat" className="w-full flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <TabsList className="grid flex-1 grid-cols-4">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Chat Advisor
                </TabsTrigger>
                <TabsTrigger value="market" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Market News
                </TabsTrigger>
                <TabsTrigger value="ai-rag" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI-RAG
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Financial Tools
                </TabsTrigger>
              </TabsList>
              {/* Stock MCP Server - Note: Full functionality requires local development (STDIO/uvx) */}
              <Link href="/stock-advisor" target="_blank">
                <Button variant="default" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                  <Database className="h-4 w-4" />
                  Stock MCP Server
                </Button>
              </Link>
            </div>

            <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">
              {/* Profile Summary Modal */}
              {showSummary && (isProfileComplete(profile) || isProfileSufficientlyComplete(profile)) && !profileConfirmed && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      Profile Summary - Review Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-green-700">
                        🎉 Great! We have gathered sufficient information about your financial profile. Please review the summary below to ensure all information is accurate.
                      </p>
                      
                      <div className="bg-white p-4 rounded-lg border border-green-200 max-h-96 overflow-y-auto">
                        <div className="prose prose-sm max-w-none">
                          <div dangerouslySetInnerHTML={{ 
                            __html: generateEditableProfileSummary(profile).replace(/\n/g, '<br>') 
                          }} />
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={handleConfirmProfile}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirm & Get Recommendations
                        </Button>
                        <Button 
                          onClick={handleEditProfile}
                          variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-100"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit Profile
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Main Layout with Profile Tracker and Chat */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0" style={{height: 'calc(100vh - 200px)'}}>
                {/* Profile Completion Tracker - Left Sidebar */}
                {/* COMMENTED OUT - Profile Summary Component */}
                {/* <div className="lg:col-span-1 flex flex-col min-h-0">
                  <ProfileCompletionTracker 
                    profile={profile}
                    className="flex-1 min-h-0"
                  />
                </div> */}

                {/* Chat Interface - Right Main Area */}
                <div className="lg:col-span-3 flex flex-col min-h-0">
                  <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
                <CardHeader className="pb-4 flex-shrink-0 border-b bg-white">
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5" />
                          Chat with STOCK-AI
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
                      {/* Real-time Profile Extraction Progress */}
                      {profileExtractionProgress && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">
                              Profile Analysis in Progress...
                            </span>
                            <span className="text-xs text-blue-600">
                              {profileExtractionProgress.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${profileExtractionProgress.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-blue-700">
                            {profileExtractionProgress.message}
                          </p>
                          {profileExtractionProgress.extractedFields.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-blue-600">Updating: </span>
                              <span className="text-xs text-blue-800 font-medium">
                                {profileExtractionProgress.extractedFields.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    
                      {messages.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                          <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="mb-4">Welcome to your STOCK-AI Advisor</p>
                          <p className="text-sm mb-4">
                            I'll help you create a personalized trading strategy. Let's start by building your profile.
                          </p>
                          <Button
                            onClick={() => sendMessage({ text: "Hello, I'm ready to start building my trading profile" })}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Bot className="w-4 h-4 mr-2" />
                            Start Profile Building
                          </Button>
                        </div>
                      ) : (
                      // Deduplicate messages by ID
                      Array.from(new Map(messages.map(m => [m.id, m])).values())
                        .map((message, index, deduplicatedMessages) => {
                        // Extract content
                        const rawContent = message.content ?? (
                          message.parts
                            ?.filter((part: any) => part.type === 'text')
                            ?.map((part: any) => part.text)
                            ?.join('') || ''
                        )
                        
                        // Parse buttons for assistant messages
                        const { text, buttons } = message.role === "assistant" 
                          ? parseQuickReplies(rawContent)
                          : { text: rawContent, buttons: null }
                        
                        // Only show buttons on the last assistant message and when not streaming
                        const showButtons = buttons && message.role === "assistant" && 
                                           index === deduplicatedMessages.length - 1 && 
                                           status === "ready"
                        
                        return (
                          <div key={message.id}>
                            <div
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
                              <div className={`flex flex-col gap-2 max-w-[80%]`}>
                                <div
                                  className={`rounded-lg px-4 py-3 break-words shadow-sm ${
                                    message.role === "user"
                                      ? "bg-blue-600 text-white ml-auto"
                                      : "bg-white border border-slate-200 text-slate-800"
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {text}
                                  </p>
                                </div>
                                
                                {/* Quick Reply Buttons */}
                                {showButtons && (
                                  <QuickReplies
                                    options={buttons.map(b => ({ text: b }))}
                                    onSelect={(value) => {
                                      sendMessage({ text: value })
                                    }}
                                    disabled={status !== "ready"}
                                  />
                                )}
                              </div>
                              {message.role === "user" && (
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-slate-100 text-slate-600">
                                    <User className="h-4 w-4" />
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          </div>
                        )
                      })
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
                    <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Ask about investments, portfolio optimization, or financial planning..."
                      className="flex-1"
                      disabled={status === "streaming" || status === "submitted"}
                    />
                    <Button
                      type="submit"
                      disabled={!text.trim() || status === "streaming" || status === "submitted"}
                      className="px-6"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    </form>
                    
                    {/* Debug Info */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-2 text-xs text-gray-500">
                        Status: {status} | Input: "{text}" | Messages: {messages.length} | Error: {error?.message || 'none'}
                      </div>
                    )}
                  </div>
                </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="market" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Market Updates & News
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 text-green-600" />
                      <h3 className="text-lg font-semibold text-green-800 mb-2">MarketAI News</h3>
                      <p className="text-green-700 mb-4">
                        Get real-time market updates, breaking news, and market analysis from our AI-powered news assistant.
                      </p>
                      <Button
                        onClick={() => window.open('/market-news', '_blank')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Open Market News
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-2">📈 Market Analysis</h4>
                        <p className="text-sm text-slate-600">Real-time market trends and sector performance</p>
                      </div>
                      <div className="p-4 bg-white border border-slate-200 rounded-lg">
                        <h4 className="font-medium text-slate-800 mb-2">📰 Breaking News</h4>
                        <p className="text-sm text-slate-600">Latest financial news and market updates</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-rag" className="flex-1 flex flex-col min-h-0">
              <RAGChat className="flex-1 min-h-0" />
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