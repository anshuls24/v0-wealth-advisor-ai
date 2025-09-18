"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  Target,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  Calculator,
} from "lucide-react"
import Link from "next/link"

export default function PortfolioDashboard() {
  const portfolioData = {
    totalValue: 2400000,
    ytdReturn: 12.4,
    monthlyReturn: 2.8,
    riskScore: "Moderate",
    lastUpdated: "2 minutes ago",
  }

  const allocations = [
    { name: "Stocks", value: 65, amount: 1560000, color: "bg-chart-1" },
    { name: "Bonds", value: 25, amount: 600000, color: "bg-chart-2" },
    { name: "Real Estate", value: 7, amount: 168000, color: "bg-chart-3" },
    { name: "Cash", value: 3, amount: 72000, color: "bg-chart-4" },
  ]

  const topHoldings = [
    { symbol: "AAPL", name: "Apple Inc.", value: 145000, change: 2.4, weight: 6.0 },
    { symbol: "MSFT", name: "Microsoft Corp.", value: 132000, change: 1.8, weight: 5.5 },
    { symbol: "GOOGL", name: "Alphabet Inc.", value: 98000, change: -0.7, weight: 4.1 },
    { symbol: "TSLA", name: "Tesla Inc.", value: 87000, change: 4.2, weight: 3.6 },
    { symbol: "NVDA", name: "NVIDIA Corp.", value: 76000, change: 3.1, weight: 3.2 },
  ]

  const goals = [
    { name: "Retirement Fund", target: 3000000, current: 2100000, progress: 70 },
    { name: "Emergency Fund", target: 100000, current: 85000, progress: 85 },
    { name: "House Down Payment", target: 200000, current: 150000, progress: 75 },
  ]

  const recentActivity = [
    { type: "buy", symbol: "AAPL", amount: 5000, date: "2 hours ago" },
    { type: "dividend", symbol: "MSFT", amount: 1200, date: "1 day ago" },
    { type: "sell", symbol: "AMZN", amount: 8500, date: "3 days ago" },
    { type: "buy", symbol: "VTI", amount: 10000, date: "1 week ago" },
  ]

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
                <h1 className="text-xl font-semibold text-foreground">Portfolio Dashboard</h1>
                <p className="text-sm text-muted-foreground">Last updated {portfolioData.lastUpdated}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat with AI
                </Button>
              </Link>
              <Link href="/tools">
                <Button variant="outline" size="sm">
                  <Calculator className="w-4 h-4 mr-2" />
                  Tools
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Portfolio Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    ${(portfolioData.totalValue / 1000000).toFixed(1)}M
                  </p>
                </div>
                <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-chart-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">YTD Return</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-chart-1">+{portfolioData.ytdReturn}%</p>
                    <ArrowUpRight className="w-4 h-4 text-chart-1" />
                  </div>
                </div>
                <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-chart-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly Return</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-chart-1">+{portfolioData.monthlyReturn}%</p>
                    <ArrowUpRight className="w-4 h-4 text-chart-1" />
                  </div>
                </div>
                <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-chart-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Risk Level</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-foreground">{portfolioData.riskScore}</p>
                    <Badge variant="outline" className="text-xs">
                      Balanced
                    </Badge>
                  </div>
                </div>
                <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-chart-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Portfolio Allocation */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Asset Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allocations.map((allocation) => (
                  <div key={allocation.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${allocation.color}`} />
                        <span className="text-sm font-medium">{allocation.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{allocation.value}%</p>
                        <p className="text-xs text-muted-foreground">${(allocation.amount / 1000).toFixed(0)}K</p>
                      </div>
                    </div>
                    <Progress value={allocation.value} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Financial Goals */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Financial Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {goals.map((goal) => (
                  <div key={goal.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{goal.name}</span>
                      <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>${(goal.current / 1000).toFixed(0)}K</span>
                      <span>${(goal.target / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Top Holdings & Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Top Holdings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Top Holdings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topHoldings.map((holding) => (
                    <div
                      key={holding.symbol}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-foreground">{holding.symbol}</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{holding.name}</p>
                          <p className="text-sm text-muted-foreground">{holding.weight}% of portfolio</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">${(holding.value / 1000).toFixed(0)}K</p>
                        <div className="flex items-center gap-1">
                          {holding.change >= 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-chart-1" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 text-destructive" />
                          )}
                          <span className={`text-sm ${holding.change >= 0 ? "text-chart-1" : "text-destructive"}`}>
                            {holding.change >= 0 ? "+" : ""}
                            {holding.change}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.type === "buy"
                              ? "bg-chart-1/10"
                              : activity.type === "sell"
                                ? "bg-destructive/10"
                                : "bg-chart-2/10"
                          }`}
                        >
                          {activity.type === "buy" ? (
                            <ArrowUpRight className={`w-4 h-4 text-chart-1`} />
                          ) : activity.type === "sell" ? (
                            <ArrowDownRight className={`w-4 h-4 text-destructive`} />
                          ) : (
                            <DollarSign className={`w-4 h-4 text-chart-2`} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground capitalize">
                            {activity.type} {activity.symbol}
                          </p>
                          <p className="text-sm text-muted-foreground">{activity.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-medium ${
                            activity.type === "buy"
                              ? "text-destructive"
                              : activity.type === "sell"
                                ? "text-chart-1"
                                : "text-chart-2"
                          }`}
                        >
                          {activity.type === "buy" ? "-" : "+"}${(activity.amount / 1000).toFixed(1)}K
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
