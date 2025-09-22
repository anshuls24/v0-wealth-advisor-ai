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
import { Send, Mic, MicOff, BarChart3, User, Bot, Calculator, TrendingUp, CheckCircle, Edit3 } from "lucide-react"
import { VoiceRecorder } from "@/components/voice-recorder"
import { ChartGenerator } from "@/components/chart-generator"
import { ClientProfile, EMPTY_PROFILE, isProfileComplete, isProfileSufficientlyComplete, generateEditableProfileSummary, getProfileCompletionPercentage } from "@/lib/profile-schema"
import { extractProfileUpdates, applyProfileUpdates } from "@/lib/profile-extractor"

// localStorage helper functions
const PROFILE_STORAGE_KEY = 'wealth_ai_profile'
const USER_ID_STORAGE_KEY = 'wealth_ai_user_id'

function saveProfileToStorage(profile: ClientProfile): void {
  if (typeof window === 'undefined') return
  
  try {
    const profileString = JSON.stringify(profile)
    console.log('💾 Saving profile to localStorage:', profileString)
    localStorage.setItem(PROFILE_STORAGE_KEY, profileString)
    
    // Verify it was saved
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY)
    console.log('✅ Verification - saved profile:', saved)
  } catch (error) {
    console.error('Error saving profile to localStorage:', error)
  }
}

function loadProfileFromStorage(): ClientProfile {
  if (typeof window === 'undefined') return EMPTY_PROFILE
  
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY)
    console.log('🔍 Raw localStorage data:', saved)
    if (saved) {
      const parsed = JSON.parse(saved) as ClientProfile
      console.log('✅ Parsed profile from localStorage:', JSON.stringify(parsed, null, 2))
      return parsed
    } else {
      console.log('❌ No data found in localStorage')
    }
  } catch (error) {
    console.error('Error loading profile from localStorage:', error)
  }
  
  console.log('🔄 Returning EMPTY_PROFILE')
  return EMPTY_PROFILE
}

function getUserId(): string {
  if (typeof window === 'undefined') return ''
  
  let userId = localStorage.getItem(USER_ID_STORAGE_KEY)
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    localStorage.setItem(USER_ID_STORAGE_KEY, userId)
  }
  
  return userId
}

export default function Home() {
  const [input, setInput] = useState("")
  const [showChartGenerator, setShowChartGenerator] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  
  // Load profile from localStorage on component mount
  const [profile, setProfile] = useState<ClientProfile>(() => {
    if (typeof window !== 'undefined') {
      const loadedProfile = loadProfileFromStorage()
      console.log('🚀 Initial profile loaded on mount:', JSON.stringify(loadedProfile, null, 2))
      return loadedProfile
    }
    return EMPTY_PROFILE
  })
  
  // Use ref to maintain current profile state for API calls - initialize with the same value as profile state
  const profileRef = useRef<ClientProfile>(profile)
  
  const [showSummary, setShowSummary] = useState(false)
  const [profileConfirmed, setProfileConfirmed] = useState(false)
  const [userId] = useState(() => getUserId())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/conversation",
      body: {
        userId: userId,
      },
    }),
    onFinish: (message) => {
      // Extract profile updates from the latest user message
      // Since onFinish is called after AI responds, we need to find the most recent user message
      if (messages.length > 0) {
        // Find the most recent user message by looking backwards
        let latestUserMessage = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            latestUserMessage = messages[i];
            break;
          }
        }
        
        if (latestUserMessage) {
          let userContent = ""
          if (latestUserMessage.parts && Array.isArray(latestUserMessage.parts)) {
            userContent = latestUserMessage.parts
              .filter((part: any) => part.type === 'text')
              .map((part: any) => part.text)
              .join('')
          }
          
          // Extract and apply profile updates
          console.log('🔍 Extracting from user message:', userContent)
          
          // Get the most current profile from localStorage to ensure we have the latest data
          const currentProfile = loadProfileFromStorage()
          console.log('📊 Current profile from localStorage:', JSON.stringify(currentProfile, null, 2))
          
          const updates = extractProfileUpdates(userContent, currentProfile)
          console.log('✅ Profile updates extracted:', updates)
          
          if (updates.length > 0) {
            const updatedProfile = applyProfileUpdates(currentProfile, updates)
            console.log('📈 Updated profile after applying updates:', JSON.stringify(updatedProfile, null, 2))
            
            // Save the updated profile to localStorage immediately
            saveProfileToStorage(updatedProfile)
            console.log('💾 Profile saved to localStorage')
            
            // Update both state and ref
            setProfile(updatedProfile)
            profileRef.current = updatedProfile
            
            // Check if profile just became complete or sufficiently complete (75%+) using the updated profile
            const profileComplete = isProfileComplete(updatedProfile)
            const profileSufficientlyComplete = isProfileSufficientlyComplete(updatedProfile)
            console.log('🎯 Profile completion status:', { profileComplete, profileSufficientlyComplete })
            if ((profileComplete || profileSufficientlyComplete) && !profileConfirmed) {
              setShowSummary(true)
              console.log('📋 Summary modal triggered')
            }
          } else {
            console.log('❌ No profile updates found')
            // Still save the current profile
            saveProfileToStorage(currentProfile)
          }
        }
      }
    },
    onError: (error) => {
      console.error('❌ Chat error:', error)
    },
  })

  // Load profile on mount
  useEffect(() => {
    const savedProfile = loadProfileFromStorage()
    console.log('🔄 Loading profile from localStorage:', JSON.stringify(savedProfile, null, 2))
    if (savedProfile && savedProfile !== EMPTY_PROFILE) {
      setProfile(savedProfile)
      profileRef.current = savedProfile
      console.log('✅ Profile loaded and set:', JSON.stringify(savedProfile, null, 2))
    } else {
      console.log('❌ No saved profile found or profile is empty')
      // Initialize profileRef with the current profile state
      profileRef.current = profile
    }
  }, [])

  // Ensure profileRef is always synchronized with profile state
  useEffect(() => {
    profileRef.current = profile
    console.log('🔄 ProfileRef synchronized with profile state:', JSON.stringify(profile, null, 2))
  }, [profile])

  // Save profile whenever it changes and update ref
  useEffect(() => {
    console.log('🔄 Profile state changed:', JSON.stringify(profile, null, 2))
    profileRef.current = profile
    console.log('💾 Saving profile to localStorage:', JSON.stringify(profile, null, 2))
    saveProfileToStorage(profile)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status === "streaming" || status === "submitted") return

    // Load the current profile before sending the message
    const currentProfile = loadProfileFromStorage()
    console.log('📤 Loading profile before sending message:', JSON.stringify(currentProfile, null, 2))
    
    sendMessage({ text: input })
    setInput("")
  }

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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PROFILE_STORAGE_KEY)
      setProfile(EMPTY_PROFILE)
      profileRef.current = EMPTY_PROFILE
      setProfileConfirmed(false)
      setShowSummary(false)
    }
  }

  const handleCheckProfile = () => {
    console.log('🔍 Check Profile button clicked!')
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
      console.log('🔍 Raw localStorage data:', stored)
      console.log('🔍 Parsed localStorage profile:', stored ? JSON.parse(stored) : null)
      console.log('🔍 Current React profile state:', JSON.stringify(profile, null, 2))
      console.log('🔍 Current profileRef:', JSON.stringify(profileRef.current, null, 2))
      
      // Also check all localStorage keys
      console.log('🔍 All localStorage keys:', Object.keys(localStorage))
      console.log('🔍 All localStorage values:', Object.keys(localStorage).map(key => ({ key, value: localStorage.getItem(key) })))
    } else {
      console.log('❌ Window is undefined - running on server')
    }
  }

  const handleRefreshProfile = () => {
    if (typeof window !== 'undefined') {
      const storedProfile = loadProfileFromStorage()
      console.log('🔄 Refreshing profile from localStorage:', JSON.stringify(storedProfile, null, 2))
      setProfile(storedProfile)
      profileRef.current = storedProfile
      console.log('✅ Profile refreshed and synchronized')
    }
  }

  const handleTestProfileUpdate = () => {
    console.log('🧪 Test Profile button clicked!')
    if (typeof window !== 'undefined') {
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
      saveProfileToStorage(testProfile)
      console.log('✅ Test profile saved')
    }
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
            
            {/* Debug Section */}
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
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
                onClick={handleClearProfile}
                variant="outline"
                size="sm"
                className="text-xs text-red-600"
              >
                🗑️ Clear Profile
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Chat Advisor
              </TabsTrigger>
              <TabsTrigger value="market" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Market News
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Financial Tools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="space-y-6">
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