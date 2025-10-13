// Simple mock implementation for RAG functionality
// This provides working document retrieval without external dependencies

export interface VectorizeDocument {
  id: string;
  content: string;
  metadata?: {
    title?: string;
    source?: string;
    url?: string;
    [key: string]: any;
  };
  score?: number;
}

export interface VectorizeResponse {
  documents: VectorizeDocument[];
  query: string;
  total_results: number;
}

export interface VectorizeError {
  error: string;
  message: string;
}

/**
 * Simple document retrieval client with mock financial documents
 */
export class VectorizeClient {
  private organizationId: string;
  private pipelineId: string;
  private accessToken: string;

  constructor(
    accessToken: string,
    organizationId: string,
    pipelineId: string
  ) {
    this.accessToken = accessToken;
    this.organizationId = organizationId;
    this.pipelineId = pipelineId;
  }

  /**
   * Retrieve relevant documents based on a query
   */
  async retrieveDocuments(
    query: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<VectorizeDocument[]> {
    console.log(`🔍 Querying documents: "${query}" (limit: ${limit}, threshold: ${threshold})`);
    
    // Mock financial documents for demonstration
    const mockDocuments: VectorizeDocument[] = [
      {
        id: "doc-1",
        content: "Financial planning is the process of creating a comprehensive strategy for managing your finances to achieve your life goals. It involves analyzing your current financial situation, setting financial objectives, and developing a plan to reach those objectives. A good financial plan includes budgeting, saving, investing, insurance, and retirement planning. Key steps include: 1) Assessing your current financial situation, 2) Setting SMART financial goals, 3) Creating a budget, 4) Developing an investment strategy, 5) Managing risk through insurance, and 6) Regular review and adjustment of your plan.",
        metadata: {
          title: "Introduction to Financial Planning",
          source: "Financial Planning Guide 2024",
          url: "https://example.com/financial-planning-guide"
        },
        score: 0.85
      },
      {
        id: "doc-2", 
        content: "Investment diversification is a risk management strategy that mixes a wide variety of investments within a portfolio. The rationale is that a portfolio of different asset types will, on average, yield higher long-term returns and lower risk. Diversification strategies include: Asset Class Diversification (stocks, bonds, real estate, commodities), Geographic Diversification (domestic and international markets), Sector Diversification (technology, healthcare, finance, etc.), and Market Cap Diversification (large-cap, mid-cap, small-cap stocks). A common rule of thumb is the 60/40 portfolio (60% stocks, 40% bonds) but this should be adjusted based on age, risk tolerance, and goals.",
        metadata: {
          title: "Investment Diversification Strategies",
          source: "Modern Portfolio Theory Guide",
          url: "https://example.com/diversification"
        },
        score: 0.82
      },
      {
        id: "doc-3",
        content: "Risk tolerance is the degree of variability in investment returns that an investor is willing to withstand. It depends on: Age (younger investors can typically handle more risk), Time Horizon (longer timelines allow for more risk), Financial Situation (income stability and savings), Investment Goals (growth vs. preservation), and Emotional Capacity (how you react to losses). Risk profiles typically fall into: Conservative (mostly bonds and cash, 20-30% stocks), Moderate (balanced approach, 50-60% stocks), Aggressive (growth-focused, 80-90% stocks). Understanding your risk tolerance is crucial before selecting investments.",
        metadata: {
          title: "Understanding Risk Tolerance in Investing",
          source: "Investor Psychology Handbook", 
          url: "https://example.com/risk-tolerance"
        },
        score: 0.80
      },
      {
        id: "doc-4",
        content: "Retirement planning requires determining retirement income goals and executing strategies to achieve them. Key retirement accounts include: 401(k) - Employer-sponsored with potential matching, contribution limit $23,000 (2024), Traditional IRA - Tax-deductible contributions, contribution limit $7,000 (2024), Roth IRA - Tax-free withdrawals in retirement, same contribution limits as traditional IRA, and SEP IRA for self-employed. The rule of thumb suggests saving 10-15% of pre-tax income, starting as early as possible. The power of compound interest means starting at 25 vs 35 can result in 2-3x more retirement savings. Consider using target-date funds for automatic rebalancing as you approach retirement.",
        metadata: {
          title: "Comprehensive Retirement Planning Guide",
          source: "Retirement Strategies 2024",
          url: "https://example.com/retirement-planning"
        },
        score: 0.78
      },
      {
        id: "doc-5",
        content: "An emergency fund is a cash reserve for unexpected expenses like medical bills, car repairs, or job loss. Financial experts recommend 3-6 months of essential living expenses. Calculate your target: Add up monthly essentials (rent/mortgage, utilities, food, insurance, minimum debt payments) and multiply by 3-6. Where to keep it: High-yield savings account (currently 4-5% APY), Money market account, or Short-term CD ladder. DO NOT invest emergency funds in stocks or volatile assets. Build it gradually: Start with $1,000, then aim for one month of expenses, then build to 3-6 months. This fund prevents debt accumulation during emergencies and provides peace of mind.",
        metadata: {
          title: "Building an Emergency Fund",
          source: "Personal Finance Essentials",
          url: "https://example.com/emergency-fund"
        },
        score: 0.75
      },
      {
        id: "doc-6",
        content: "Tax-advantaged investing strategies can significantly impact your wealth accumulation. Key strategies: 1) Maximize 401(k) contributions especially to get full employer match (free money), 2) Use Roth vs Traditional IRA strategically - Roth if expecting higher tax bracket in retirement, Traditional for immediate tax deduction, 3) Tax-loss harvesting - selling losing investments to offset capital gains, 4) Hold investments longer than 1 year for long-term capital gains rates (0%, 15%, or 20% vs ordinary income rates up to 37%), 5) Use HSA (Health Savings Account) as stealth retirement account - triple tax advantage (deductible contributions, tax-free growth, tax-free withdrawals for medical). Tax efficiency can add 1-2% annually to after-tax returns.",
        metadata: {
          title: "Tax-Efficient Investing Strategies",
          source: "Tax Planning for Investors",
          url: "https://example.com/tax-strategies"
        },
        score: 0.77
      },
      {
        id: "doc-7",
        content: "Asset allocation is the implementation of an investment strategy that balances risk and reward by dividing assets among different categories. Common frameworks: Age-based rule: Subtract your age from 110 (or 120) to get stock percentage (e.g., 30 year old = 110-30 = 80% stocks). Three-fund portfolio: Total US stock market fund, Total international stock fund, Total bond market fund. Risk-based allocation: Conservative (30% stocks, 70% bonds), Moderate (60% stocks, 40% bonds), Aggressive (90% stocks, 10% bonds). Rebalancing is crucial - review quarterly and rebalance annually or when allocation drifts 5%+ from target. This forces you to 'buy low, sell high' systematically.",
        metadata: {
          title: "Asset Allocation Fundamentals",
          source: "Portfolio Construction Manual",
          url: "https://example.com/asset-allocation"
        },
        score: 0.79
      },
      {
        id: "doc-8",
        content: "Understanding investment fees is critical as they compound against you over time. Types of fees: Expense Ratios (annual fee as percentage of assets, index funds ~0.03-0.20%, active funds ~0.50-2.00%), Trading Commissions (most brokers now $0 for stocks/ETFs), Management Fees (financial advisors typically 0.5-1.5% of AUM), and Load Fees (sales charges on mutual funds - avoid these). Impact example: Over 30 years, a 1% fee can reduce your final portfolio value by 25%. Solution: Use low-cost index funds, avoid load funds, minimize trading, consider robo-advisors (0.25% fee) vs traditional advisors (1% fee). Every 0.1% in fees matters over decades.",
        metadata: {
          title: "Investment Fees and Their Impact",
          source: "Cost-Conscious Investing Guide",
          url: "https://example.com/investment-fees"
        },
        score: 0.73
      },
      {
        id: "doc-9",
        content: "Dollar-cost averaging (DCA) is an investment strategy where you invest a fixed amount regularly regardless of market conditions. Benefits: Reduces timing risk (no need to predict market tops/bottoms), Lowers average cost per share over time, Removes emotion from investing, Easy to automate. Example: Investing $500/month - you buy more shares when prices are low, fewer when high. This is built into 401(k) contributions. Alternative is lump-sum investing which historically outperforms DCA 2/3 of the time but requires discipline and cash available. For most people receiving regular income, DCA is the practical approach. Avoid stopping DCA during downturns - this is when you benefit most.",
        metadata: {
          title: "Dollar-Cost Averaging Strategy",
          source: "Investment Timing Strategies",
          url: "https://example.com/dollar-cost-averaging"
        },
        score: 0.71
      },
      {
        id: "doc-10",
        content: "ESG investing (Environmental, Social, and Governance) integrates ethical considerations into investment decisions. ESG factors: Environmental (climate change impact, renewable energy, waste management), Social (labor practices, diversity, community relations), Governance (board diversity, executive compensation, shareholder rights). Approaches: Negative Screening (excluding tobacco, weapons, fossil fuels), Positive Screening (investing in clean energy, sustainable companies), ESG Integration (considering ESG factors alongside financial metrics), Impact Investing (investing to generate social/environmental impact). Performance: Studies show ESG funds perform comparably to traditional funds, with potentially lower volatility. Many major index fund providers (Vanguard, BlackRock) offer ESG versions of popular indices. ESG expense ratios typically 0.05-0.20% higher than non-ESG equivalents.",
        metadata: {
          title: "ESG and Sustainable Investing",
          source: "Responsible Investment Guide",
          url: "https://example.com/esg-investing"
        },
        score: 0.69
      }
    ];

    // Enhanced keyword matching for relevance
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.replace(/[^\w]/g, '')); // Remove punctuation
    
    const scoredDocs = mockDocuments.map(doc => {
      const contentWords = doc.content.toLowerCase();
      const titleWords = doc.metadata?.title?.toLowerCase() || '';
      const sourceWords = doc.metadata?.source?.toLowerCase() || '';
      
      let relevanceScore = 0.5; // Base score
      let matchCount = 0;
      
      // Score based on keyword matches
      queryWords.forEach(word => {
        if (word.length < 3) return;
        
        // Title matches are most valuable
        if (titleWords.includes(word)) {
          relevanceScore += 0.2;
          matchCount++;
        }
        
        // Content matches
        const contentMatches = (contentWords.match(new RegExp(word, 'g')) || []).length;
        if (contentMatches > 0) {
          relevanceScore += Math.min(0.15 * contentMatches, 0.3); // Cap at 0.3 per word
          matchCount++;
        }
        
        // Source matches
        if (sourceWords.includes(word)) {
          relevanceScore += 0.1;
        }
      });
      
      // Boost score if multiple query words match
      if (queryWords.length > 1 && matchCount > 1) {
        relevanceScore += 0.1 * (matchCount / queryWords.length);
      }
      
      // Normalize to 0-1 range
      return { ...doc, score: Math.min(0.99, relevanceScore) };
    });

    // Filter by threshold and sort by relevance
    const filteredDocs = scoredDocs
      .filter(doc => (doc.score || 0) >= threshold)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);

    console.log(`✅ Returning ${filteredDocs.length} relevant documents`);
    return filteredDocs;
  }

  /**
   * Format retrieved documents as context for LLM
   */
  formatDocumentsAsContext(documents: VectorizeDocument[]): string {
    if (documents.length === 0) {
      return "No relevant documents found.";
    }

    return documents
      .map((doc, index) => {
        const title = doc.metadata?.title || `Document ${index + 1}`;
        const source = doc.metadata?.source || "Unknown source";
        const score = doc.score ? ` (Relevance: ${(doc.score * 100).toFixed(1)}%)` : "";
        
        return `## ${title}${score}
Source: ${source}

${doc.content}

---`;
      })
      .join("\n\n");
  }
}