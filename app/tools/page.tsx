"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calculator,
  TrendingUp,
  PieChart,
  Target,
  DollarSign,
  Percent,
  MessageSquare,
  LayoutDashboard,
} from "lucide-react"
import Link from "next/link"

export default function FinancialTools() {
  // Retirement Calculator State
  const [retirementData, setRetirementData] = useState({
    currentAge: "",
    retirementAge: "",
    currentSavings: "",
    monthlyContribution: "",
    expectedReturn: "7",
    result: null as any,
  })

  // Risk Assessment State
  const [riskAnswers, setRiskAnswers] = useState({
    timeHorizon: "",
    riskTolerance: "",
    investmentGoal: "",
    result: null as any,
  })

  // Portfolio Rebalancer State
  const [portfolioData, setPortfolioData] = useState({
    stocks: "",
    bonds: "",
    reits: "",
    cash: "",
    targetStocks: "60",
    targetBonds: "30",
    targetReits: "7",
    targetCash: "3",
    result: null as any,
  })

  const calculateRetirement = () => {
    const currentAge = Number.parseInt(retirementData.currentAge)
    const retirementAge = Number.parseInt(retirementData.retirementAge)
    const currentSavings = Number.parseFloat(retirementData.currentSavings)
    const monthlyContribution = Number.parseFloat(retirementData.monthlyContribution)
    const annualReturn = Number.parseFloat(retirementData.expectedReturn) / 100

    const yearsToRetirement = retirementAge - currentAge
    const monthsToRetirement = yearsToRetirement * 12
    const monthlyReturn = annualReturn / 12

    // Future value calculation
    const futureValueCurrent = currentSavings * Math.pow(1 + annualReturn, yearsToRetirement)
    const futureValueContributions =
      monthlyContribution * ((Math.pow(1 + monthlyReturn, monthsToRetirement) - 1) / monthlyReturn)

    const totalAtRetirement = futureValueCurrent + futureValueContributions

    setRetirementData({
      ...retirementData,
      result: {
        totalAtRetirement: Math.round(totalAtRetirement),
        yearsToRetirement,
        monthlyNeeded: Math.round((totalAtRetirement * 0.04) / 12), // 4% rule
      },
    })
  }

  const calculateRiskProfile = () => {
    let score = 0

    // Time horizon scoring
    if (riskAnswers.timeHorizon === "long") score += 3
    else if (riskAnswers.timeHorizon === "medium") score += 2
    else score += 1

    // Risk tolerance scoring
    if (riskAnswers.riskTolerance === "high") score += 3
    else if (riskAnswers.riskTolerance === "medium") score += 2
    else score += 1

    // Investment goal scoring
    if (riskAnswers.investmentGoal === "growth") score += 3
    else if (riskAnswers.investmentGoal === "balanced") score += 2
    else score += 1

    let profile = "Conservative"
    let allocation = { stocks: 30, bonds: 60, reits: 5, cash: 5 }

    if (score >= 7) {
      profile = "Aggressive"
      allocation = { stocks: 80, bonds: 15, reits: 3, cash: 2 }
    } else if (score >= 5) {
      profile = "Moderate"
      allocation = { stocks: 60, bonds: 30, reits: 7, cash: 3 }
    }

    setRiskAnswers({
      ...riskAnswers,
      result: { profile, allocation, score },
    })
  }

  const calculateRebalancing = () => {
    const current = {
      stocks: Number.parseFloat(portfolioData.stocks) || 0,
      bonds: Number.parseFloat(portfolioData.bonds) || 0,
      reits: Number.parseFloat(portfolioData.reits) || 0,
      cash: Number.parseFloat(portfolioData.cash) || 0,
    }

    const target = {
      stocks: Number.parseFloat(portfolioData.targetStocks),
      bonds: Number.parseFloat(portfolioData.targetBonds),
      reits: Number.parseFloat(portfolioData.targetReits),
      cash: Number.parseFloat(portfolioData.targetCash),
    }

    const totalValue = current.stocks + current.bonds + current.reits + current.cash

    const currentPercentages = {
      stocks: (current.stocks / totalValue) * 100,
      bonds: (current.bonds / totalValue) * 100,
      reits: (current.reits / totalValue) * 100,
      cash: (current.cash / totalValue) * 100,
    }

    const adjustments = {
      stocks: (target.stocks / 100) * totalValue - current.stocks,
      bonds: (target.bonds / 100) * totalValue - current.bonds,
      reits: (target.reits / 100) * totalValue - current.reits,
      cash: (target.cash / 100) * totalValue - current.cash,
    }

    setPortfolioData({
      ...portfolioData,
      result: {
        currentPercentages,
        adjustments,
        totalValue,
        needsRebalancing: Math.abs(adjustments.stocks) > totalValue * 0.05,
      },
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Financial Tools</h1>
                <p className="text-sm text-muted-foreground">Calculate, analyze, and optimize your finances</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat with AI
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

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="retirement" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="retirement" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Retirement Calculator
            </TabsTrigger>
            <TabsTrigger value="risk" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Risk Assessment
            </TabsTrigger>
            <TabsTrigger value="rebalance" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Portfolio Rebalancer
            </TabsTrigger>
          </TabsList>

          {/* Retirement Calculator */}
          <TabsContent value="retirement">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Retirement Planning Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-age">Current Age</Label>
                      <Input
                        id="current-age"
                        type="number"
                        value={retirementData.currentAge}
                        onChange={(e) => setRetirementData({ ...retirementData, currentAge: e.target.value })}
                        placeholder="35"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retirement-age">Retirement Age</Label>
                      <Input
                        id="retirement-age"
                        type="number"
                        value={retirementData.retirementAge}
                        onChange={(e) => setRetirementData({ ...retirementData, retirementAge: e.target.value })}
                        placeholder="65"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current-savings">Current Savings ($)</Label>
                    <Input
                      id="current-savings"
                      type="number"
                      value={retirementData.currentSavings}
                      onChange={(e) => setRetirementData({ ...retirementData, currentSavings: e.target.value })}
                      placeholder="50000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthly-contribution">Monthly Contribution ($)</Label>
                    <Input
                      id="monthly-contribution"
                      type="number"
                      value={retirementData.monthlyContribution}
                      onChange={(e) => setRetirementData({ ...retirementData, monthlyContribution: e.target.value })}
                      placeholder="1000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expected-return">Expected Annual Return (%)</Label>
                    <Select
                      value={retirementData.expectedReturn}
                      onValueChange={(value) => setRetirementData({ ...retirementData, expectedReturn: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5% (Conservative)</SelectItem>
                        <SelectItem value="7">7% (Moderate)</SelectItem>
                        <SelectItem value="9">9% (Aggressive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={calculateRetirement} className="w-full">
                    <Calculator className="w-4 h-4 mr-2" />
                    Calculate Retirement
                  </Button>
                </CardContent>
              </Card>

              {retirementData.result && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Retirement Projection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center p-6 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Total at Retirement</p>
                      <p className="text-3xl font-bold text-chart-1">
                        ${retirementData.result.totalAtRetirement.toLocaleString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-card border border-border rounded-lg">
                        <p className="text-sm text-muted-foreground">Years to Retirement</p>
                        <p className="text-xl font-semibold text-foreground">
                          {retirementData.result.yearsToRetirement}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-card border border-border rounded-lg">
                        <p className="text-sm text-muted-foreground">Monthly Income (4% Rule)</p>
                        <p className="text-xl font-semibold text-foreground">
                          ${retirementData.result.monthlyNeeded.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-chart-1/10 rounded-lg">
                      <p className="text-sm text-chart-1 font-medium">💡 Tip</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Consider increasing contributions by 1% annually to boost your retirement savings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Risk Assessment */}
          <TabsContent value="risk">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Investment Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Investment Time Horizon</Label>
                    <Select
                      value={riskAnswers.timeHorizon}
                      onValueChange={(value) => setRiskAnswers({ ...riskAnswers, timeHorizon: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time horizon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Less than 5 years</SelectItem>
                        <SelectItem value="medium">5-15 years</SelectItem>
                        <SelectItem value="long">More than 15 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Risk Tolerance</Label>
                    <Select
                      value={riskAnswers.riskTolerance}
                      onValueChange={(value) => setRiskAnswers({ ...riskAnswers, riskTolerance: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select risk tolerance" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Prefer stable returns</SelectItem>
                        <SelectItem value="medium">Medium - Balanced approach</SelectItem>
                        <SelectItem value="high">High - Comfortable with volatility</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Primary Investment Goal</Label>
                    <Select
                      value={riskAnswers.investmentGoal}
                      onValueChange={(value) => setRiskAnswers({ ...riskAnswers, investmentGoal: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select investment goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preservation">Capital Preservation</SelectItem>
                        <SelectItem value="balanced">Balanced Growth & Income</SelectItem>
                        <SelectItem value="growth">Maximum Growth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={calculateRiskProfile} className="w-full">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Assess Risk Profile
                  </Button>
                </CardContent>
              </Card>

              {riskAnswers.result && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">
                        {riskAnswers.result.profile}
                      </Badge>
                      Risk Profile Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center p-6 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Your Risk Profile</p>
                      <p className="text-2xl font-bold text-foreground">{riskAnswers.result.profile}</p>
                      <p className="text-sm text-muted-foreground mt-1">Score: {riskAnswers.result.score}/9</p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium text-foreground">Recommended Allocation</h4>
                      {Object.entries(riskAnswers.result.allocation).map(([asset, percentage]) => (
                        <div key={asset} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{asset}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-chart-1 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="text-sm font-medium w-8">{percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Portfolio Rebalancer */}
          <TabsContent value="rebalance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Portfolio Rebalancing Tool
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Current Holdings ($)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="current-stocks">Stocks</Label>
                        <Input
                          id="current-stocks"
                          type="number"
                          value={portfolioData.stocks}
                          onChange={(e) => setPortfolioData({ ...portfolioData, stocks: e.target.value })}
                          placeholder="150000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-bonds">Bonds</Label>
                        <Input
                          id="current-bonds"
                          type="number"
                          value={portfolioData.bonds}
                          onChange={(e) => setPortfolioData({ ...portfolioData, bonds: e.target.value })}
                          placeholder="75000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-reits">REITs</Label>
                        <Input
                          id="current-reits"
                          type="number"
                          value={portfolioData.reits}
                          onChange={(e) => setPortfolioData({ ...portfolioData, reits: e.target.value })}
                          placeholder="15000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-cash">Cash</Label>
                        <Input
                          id="current-cash"
                          type="number"
                          value={portfolioData.cash}
                          onChange={(e) => setPortfolioData({ ...portfolioData, cash: e.target.value })}
                          placeholder="10000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Target Allocation (%)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="target-stocks">Stocks</Label>
                        <Input
                          id="target-stocks"
                          type="number"
                          value={portfolioData.targetStocks}
                          onChange={(e) => setPortfolioData({ ...portfolioData, targetStocks: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="target-bonds">Bonds</Label>
                        <Input
                          id="target-bonds"
                          type="number"
                          value={portfolioData.targetBonds}
                          onChange={(e) => setPortfolioData({ ...portfolioData, targetBonds: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="target-reits">REITs</Label>
                        <Input
                          id="target-reits"
                          type="number"
                          value={portfolioData.targetReits}
                          onChange={(e) => setPortfolioData({ ...portfolioData, targetReits: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="target-cash">Cash</Label>
                        <Input
                          id="target-cash"
                          type="number"
                          value={portfolioData.targetCash}
                          onChange={(e) => setPortfolioData({ ...portfolioData, targetCash: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={calculateRebalancing} className="w-full">
                    <PieChart className="w-4 h-4 mr-2" />
                    Calculate Rebalancing
                  </Button>
                </CardContent>
              </Card>

              {portfolioData.result && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="w-5 h-5" />
                      Rebalancing Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Portfolio Value</p>
                      <p className="text-2xl font-bold text-foreground">
                        ${portfolioData.result.totalValue.toLocaleString()}
                      </p>
                      <Badge
                        variant={portfolioData.result.needsRebalancing ? "destructive" : "secondary"}
                        className="mt-2"
                      >
                        {portfolioData.result.needsRebalancing ? "Rebalancing Needed" : "Well Balanced"}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium text-foreground">Adjustments Needed</h4>
                      {Object.entries(portfolioData.result.adjustments).map(([asset, amount]) => (
                        <div
                          key={asset}
                          className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
                        >
                          <span className="text-sm capitalize font-medium">{asset}</span>
                          <div className="text-right">
                            <p
                              className={`text-sm font-medium ${
                                amount > 0 ? "text-chart-1" : amount < 0 ? "text-destructive" : "text-muted-foreground"
                              }`}
                            >
                              {amount > 0 ? "+" : ""}${Math.round(amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {portfolioData.result.currentPercentages[asset].toFixed(1)}% current
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
