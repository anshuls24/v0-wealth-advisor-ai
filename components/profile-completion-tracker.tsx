"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  CheckCircle, 
  Circle, 
  User, 
  Target, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Heart, 
  Lightbulb,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react"
import { ClientProfile, EMPTY_PROFILE, getProfileCompletionPercentage, getMissingFields } from "@/lib/profile-schema"

interface ProfileSection {
  id: string
  title: string
  icon: React.ElementType
  isComplete: boolean
  details: string
  warning?: string
}

interface ProfileCompletionTrackerProps {
  profile: ClientProfile
  className?: string
}

export function ProfileCompletionTracker({ profile, className = "" }: ProfileCompletionTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Simple mount check
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Force re-render when profile changes
  useEffect(() => {
    // Trigger a state update to force re-render of sections when profile changes
    setIsExpanded(prev => prev) // This forces a re-render without changing the value
  }, [profile])
  
  // Prevent hydration mismatch by using empty profile until mounted
  const safeProfile = mounted ? profile : EMPTY_PROFILE
  const completionPercentage = mounted ? getProfileCompletionPercentage(profile) : 0
  const missingFields = mounted ? getMissingFields(profile) : []
  
  // Define profile sections based on your schema - use useMemo to ensure updates when profile changes
  const sections: ProfileSection[] = useMemo(() => [
    {
      id: "goals",
      title: "Financial Goals",
      icon: Target,
      isComplete: (() => {
        const goalCount = [
          safeProfile.goals.short_term,
          safeProfile.goals.medium_term,
          safeProfile.goals.long_term
        ].filter(Boolean).length
        return goalCount >= 2
      })(),
      details: (() => {
        const goals = []
        if (safeProfile.goals.short_term) goals.push("Short-term")
        if (safeProfile.goals.medium_term) goals.push("Medium-term")  
        if (safeProfile.goals.long_term) goals.push("Long-term")
        return goals.length > 0 ? `${goals.join(", ")} goals set` : "No goals defined"
      })(),
      warning: (() => {
        const goalCount = [
          safeProfile.goals.short_term,
          safeProfile.goals.medium_term,
          safeProfile.goals.long_term
        ].filter(Boolean).length
        return goalCount < 2 ? "Need at least 2 timeframes" : undefined
      })()
    },
    {
      id: "risk",
      title: "Risk Assessment",
      icon: TrendingUp,
      isComplete: !!safeProfile.risk.tolerance,
      details: safeProfile.risk.tolerance || "Risk tolerance not assessed",
      warning: !safeProfile.risk.tolerance ? "Risk tolerance required" : undefined
    },
    {
      id: "financials",
      title: "Financial Situation", 
      icon: DollarSign,
      isComplete: !!safeProfile.financials.assets,
      details: (() => {
        const items = []
        if (safeProfile.financials.income) items.push("Income")
        if (safeProfile.financials.assets) items.push("Assets")
        if (safeProfile.financials.expenses) items.push("Expenses")
        return items.length > 0 ? `${items.join(", ")} provided` : "No financial data"
      })(),
      warning: !safeProfile.financials.assets ? "Assets information needed" : undefined
    },
    {
      id: "time_horizon",
      title: "Time Horizon",
      icon: Clock,
      isComplete: !!safeProfile.time_horizon,
      details: safeProfile.time_horizon || "Investment timeline not set",
      warning: !safeProfile.time_horizon ? "Time horizon required" : undefined
    },
    {
      id: "preferences",
      title: "Investment Preferences",
      icon: Heart,
      isComplete: safeProfile.preferences.length >= 1,
      details: safeProfile.preferences.length > 0 
        ? `${safeProfile.preferences.length} preference${safeProfile.preferences.length === 1 ? '' : 's'} set`
        : "No preferences defined",
      warning: safeProfile.preferences.length < 1 ? "At least 1 preference needed" : undefined
    },
    {
      id: "expectations", 
      title: "Return Expectations",
      icon: Lightbulb,
      isComplete: safeProfile.expectations.length >= 1,
      details: safeProfile.expectations.length > 0
        ? `${safeProfile.expectations.length} expectation${safeProfile.expectations.length === 1 ? '' : 's'} set`
        : "No expectations defined",
      warning: safeProfile.expectations.length < 1 ? "At least 1 expectation needed" : undefined
    }
  ], [safeProfile, mounted])
  
  const completedSections = sections.filter(section => section.isComplete).length
  const totalSections = sections.length

  return (
    <Card className={`w-full h-full flex flex-col ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-blue-600" />
            Profile Summary
          </CardTitle>
          <Badge variant={completionPercentage >= 100 ? "default" : "secondary"}>
            {completionPercentage}% Complete
          </Badge>
        </div>
        
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Profile Requirements ({completedSections}/{totalSections})</span>
            <span>{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="w-full" />
        </div>
        
        {/* Completion status */}
        {completionPercentage >= 100 ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-800 font-medium">
              Profile complete! Ready for personalized recommendations.
            </span>
          </div>
        ) : missingFields.length > 0 ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              Still need: {missingFields.length === 1 ? `${missingFields[0].replace(/_/g, ' ')}` : `${missingFields.length} more items`}
            </span>
          </div>
        ) : null}
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
        {/* Always show first 3 sections, toggle for rest */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {sections.slice(0, isExpanded ? sections.length : 3).map((section) => {
            const Icon = section.icon
            return (
              <div
                key={section.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  {section.isComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {section.title}
                    </p>
                    {section.isComplete && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        ✓
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {section.details}
                  </p>
                  {section.warning && (
                    <p className="text-xs text-amber-600 mt-1">
                      {section.warning}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Debug Panel - Remove this after testing */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-100 rounded-lg border text-xs">
            <p className="font-medium mb-2">🐛 Debug Info:</p>
            <p>Mounted: {mounted.toString()}</p>
            <p>Goals: {JSON.stringify(safeProfile.goals)}</p>
            <p>Risk: {JSON.stringify(safeProfile.risk)}</p>
            <p>Assets: {safeProfile.financials.assets || 'none'}</p>
            <p>Time: {safeProfile.time_horizon || 'none'}</p>
            <p>Prefs: [{safeProfile.preferences.join(', ')}]</p>
            <p>Expects: [{safeProfile.expectations.join(', ')}]</p>
            <p>Completion: {completionPercentage}%</p>
          </div>
        )}
        
        {/* Toggle button for showing more/less */}
        <div className="mt-4 flex-shrink-0">
          {sections.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show All Requirements ({sections.length - 3} more)
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
