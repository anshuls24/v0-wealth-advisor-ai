// Vectorize service for document retrieval
// Matches the pattern from typescript-next-starter

export interface VectorizeDocument {
  chunk_id: string;
  id: string;
  org_id: string;
  origin: string;
  origin_id: string;
  pipeline_id: string;
  similarity: number;
  source: string;
  source_display_name: string;
  text: string;
  total_chunks: string;
  unique_source: string;
  relevancy: number;
  // Camel case duplicates for compatibility
  chunkId: string;
  totalChunks: string;
  originId: string;
  uniqueSource: string;
  sourceDisplayName: string;
  pipelineId: string;
  orgId: string;
}

export interface ChatSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
  relevancy: number;
  similarity: number;
}

export class VectorizeService {
  private organizationId: string;
  private pipelineId: string;
  private accessToken: string;

  constructor() {
    this.accessToken = process.env.VECTORIZE_ACCESS_TOKEN || process.env.VECTORIZE_PIPELINE_ACCESS_TOKEN || 'mock-token';
    this.organizationId = process.env.VECTORIZE_ORG_ID || process.env.VECTORIZE_ORGANIZATION_ID || 'mock-org';
    this.pipelineId = process.env.VECTORIZE_PIPELINE_ID || 'mock-pipeline';
  }

  async retrieveDocuments(
    question: string,
    numResults: number = 5
  ): Promise<VectorizeDocument[]> {
    console.log(`🔍 Vectorize: Retrieving documents for: "${question}" (numResults: ${numResults})`);
    
    // Mock implementation that returns financial documents
    // In production, this would use the official Vectorize client:
    // const config = new Configuration({
    //   accessToken: this.accessToken,
    //   basePath: "https://api.vectorize.io/v1",
    // });
    // const pipelinesApi = new PipelinesApi(config);
    // const response = await pipelinesApi.retrieveDocuments({
    //   organizationId: this.organizationId,
    //   pipelineId: this.pipelineId,
    //   retrieveDocumentsRequest: { question, numResults },
    // });
    // return response.documents || [];

    try {
      // Mock financial documents for demonstration
      const mockDocs = this.getMockDocuments();
      
      // Score documents based on keyword matching
      const queryWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const scoredDocs = mockDocs.map(doc => {
        let score = 0.5;
        queryWords.forEach(word => {
          if (doc.text.toLowerCase().includes(word)) score += 0.15;
          if (doc.source_display_name.toLowerCase().includes(word)) score += 0.1;
        });
        return { ...doc, similarity: Math.min(0.99, score), relevancy: Math.min(0.99, score) };
      });

      // Sort by relevancy and limit results
      const results = scoredDocs
        .sort((a, b) => b.relevancy - a.relevancy)
        .slice(0, numResults);

      console.log(`✅ Vectorize: Retrieved ${results.length} documents`);
      return results;
    } catch (error: any) {
      console.error("Vectorize API Error:", error);
      throw new Error(
        `Failed to retrieve documents from Vectorize: ${error?.message || "Unknown error"}`
      );
    }
  }

  formatDocumentsForContext(documents: VectorizeDocument[]): string {
    if (!documents.length) {
      return "No relevant documents found.";
    }

    return documents
      .map((doc, index) => `Document ${index + 1}:\n${doc.text}`)
      .join("\n\n---\n\n");
  }

  convertDocumentsToChatSources(documents: VectorizeDocument[]): ChatSource[] {
    return documents.map((doc) => ({
      id: doc.id,
      title: doc.source_display_name || doc.source,
      url: doc.source,
      snippet: doc.text.substring(0, 200) + "...",
      relevancy: doc.relevancy,
      similarity: doc.similarity,
    }));
  }

  private getMockDocuments(): VectorizeDocument[] {
    const createDoc = (
      id: string,
      title: string,
      source: string,
      text: string
    ): VectorizeDocument => ({
      chunk_id: `chunk-${id}`,
      id,
      org_id: this.organizationId,
      origin: "financial-kb",
      origin_id: id,
      pipeline_id: this.pipelineId,
      similarity: 0.85,
      source,
      source_display_name: title,
      text,
      total_chunks: "1",
      unique_source: source,
      relevancy: 0.85,
      // Camel case duplicates
      chunkId: `chunk-${id}`,
      totalChunks: "1",
      originId: id,
      uniqueSource: source,
      sourceDisplayName: title,
      pipelineId: this.pipelineId,
      orgId: this.organizationId,
    });

    return [
      createDoc(
        "doc-1",
        "Introduction to Financial Planning",
        "https://example.com/financial-planning-guide",
        "Financial planning is the process of creating a comprehensive strategy for managing your finances to achieve your life goals. It involves analyzing your current financial situation, setting financial objectives, and developing a plan to reach those objectives. A good financial plan includes budgeting, saving, investing, insurance, and retirement planning. Key steps include: 1) Assessing your current financial situation, 2) Setting SMART financial goals, 3) Creating a budget, 4) Developing an investment strategy, 5) Managing risk through insurance, and 6) Regular review and adjustment of your plan."
      ),
      createDoc(
        "doc-2",
        "Investment Diversification Strategies",
        "https://example.com/diversification",
        "Investment diversification is a risk management strategy that mixes a wide variety of investments within a portfolio. The rationale is that a portfolio of different asset types will, on average, yield higher long-term returns and lower risk. Diversification strategies include: Asset Class Diversification (stocks, bonds, real estate, commodities), Geographic Diversification (domestic and international markets), Sector Diversification (technology, healthcare, finance, etc.), and Market Cap Diversification (large-cap, mid-cap, small-cap stocks). A common rule of thumb is the 60/40 portfolio (60% stocks, 40% bonds) but this should be adjusted based on age, risk tolerance, and goals."
      ),
      createDoc(
        "doc-3",
        "Understanding Risk Tolerance in Investing",
        "https://example.com/risk-tolerance",
        "Risk tolerance is the degree of variability in investment returns that an investor is willing to withstand. It depends on: Age (younger investors can typically handle more risk), Time Horizon (longer timelines allow for more risk), Financial Situation (income stability and savings), Investment Goals (growth vs. preservation), and Emotional Capacity (how you react to losses). Risk profiles typically fall into: Conservative (mostly bonds and cash, 20-30% stocks), Moderate (balanced approach, 50-60% stocks), Aggressive (growth-focused, 80-90% stocks). Understanding your risk tolerance is crucial before selecting investments."
      ),
      createDoc(
        "doc-4",
        "Comprehensive Retirement Planning Guide",
        "https://example.com/retirement-planning",
        "Retirement planning requires determining retirement income goals and executing strategies to achieve them. Key retirement accounts include: 401(k) - Employer-sponsored with potential matching, contribution limit $23,000 (2024), Traditional IRA - Tax-deductible contributions, contribution limit $7,000 (2024), Roth IRA - Tax-free withdrawals in retirement, same contribution limits as traditional IRA, and SEP IRA for self-employed. The rule of thumb suggests saving 10-15% of pre-tax income, starting as early as possible. The power of compound interest means starting at 25 vs 35 can result in 2-3x more retirement savings."
      ),
      createDoc(
        "doc-5",
        "Building an Emergency Fund",
        "https://example.com/emergency-fund",
        "An emergency fund is a cash reserve for unexpected expenses like medical bills, car repairs, or job loss. Financial experts recommend 3-6 months of essential living expenses. Calculate your target: Add up monthly essentials (rent/mortgage, utilities, food, insurance, minimum debt payments) and multiply by 3-6. Where to keep it: High-yield savings account (currently 4-5% APY), Money market account, or Short-term CD ladder. DO NOT invest emergency funds in stocks or volatile assets. Build it gradually: Start with $1,000, then aim for one month of expenses, then build to 3-6 months."
      ),
      createDoc(
        "doc-6",
        "Tax-Efficient Investing Strategies",
        "https://example.com/tax-strategies",
        "Tax-advantaged investing strategies can significantly impact your wealth accumulation. Key strategies: 1) Maximize 401(k) contributions especially to get full employer match (free money), 2) Use Roth vs Traditional IRA strategically - Roth if expecting higher tax bracket in retirement, Traditional for immediate tax deduction, 3) Tax-loss harvesting - selling losing investments to offset capital gains, 4) Hold investments longer than 1 year for long-term capital gains rates (0%, 15%, or 20% vs ordinary income rates up to 37%), 5) Use HSA (Health Savings Account) as stealth retirement account - triple tax advantage."
      ),
      createDoc(
        "doc-7",
        "Asset Allocation Fundamentals",
        "https://example.com/asset-allocation",
        "Asset allocation is the implementation of an investment strategy that balances risk and reward by dividing assets among different categories. Common frameworks: Age-based rule: Subtract your age from 110 (or 120) to get stock percentage (e.g., 30 year old = 110-30 = 80% stocks). Three-fund portfolio: Total US stock market fund, Total international stock fund, Total bond market fund. Risk-based allocation: Conservative (30% stocks, 70% bonds), Moderate (60% stocks, 40% bonds), Aggressive (90% stocks, 10% bonds). Rebalancing is crucial - review quarterly and rebalance annually or when allocation drifts 5%+ from target."
      ),
      createDoc(
        "doc-8",
        "Investment Fees and Their Impact",
        "https://example.com/investment-fees",
        "Understanding investment fees is critical as they compound against you over time. Types of fees: Expense Ratios (annual fee as percentage of assets, index funds ~0.03-0.20%, active funds ~0.50-2.00%), Trading Commissions (most brokers now $0 for stocks/ETFs), Management Fees (financial advisors typically 0.5-1.5% of AUM), and Load Fees (sales charges on mutual funds - avoid these). Impact example: Over 30 years, a 1% fee can reduce your final portfolio value by 25%. Solution: Use low-cost index funds, avoid load funds, minimize trading."
      ),
      createDoc(
        "doc-9",
        "Dollar-Cost Averaging Strategy",
        "https://example.com/dollar-cost-averaging",
        "Dollar-cost averaging (DCA) is an investment strategy where you invest a fixed amount regularly regardless of market conditions. Benefits: Reduces timing risk (no need to predict market tops/bottoms), Lowers average cost per share over time, Removes emotion from investing, Easy to automate. Example: Investing $500/month - you buy more shares when prices are low, fewer when high. This is built into 401(k) contributions. For most people receiving regular income, DCA is the practical approach."
      ),
      createDoc(
        "doc-10",
        "ESG and Sustainable Investing",
        "https://example.com/esg-investing",
        "ESG investing (Environmental, Social, and Governance) integrates ethical considerations into investment decisions. ESG factors: Environmental (climate change impact, renewable energy, waste management), Social (labor practices, diversity, community relations), Governance (board diversity, executive compensation, shareholder rights). Approaches: Negative Screening (excluding tobacco, weapons, fossil fuels), Positive Screening (investing in clean energy, sustainable companies), ESG Integration (considering ESG factors alongside financial metrics)."
      ),
    ];
  }
}

