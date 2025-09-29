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
        content: "Financial planning is the process of creating a comprehensive strategy for managing your finances to achieve your life goals. It involves analyzing your current financial situation, setting financial objectives, and developing a plan to reach those objectives. A good financial plan includes budgeting, saving, investing, insurance, and retirement planning.",
        metadata: {
          title: "Introduction to Financial Planning",
          source: "Financial Planning Guide",
          url: "https://example.com/financial-planning-guide"
        },
        score: 0.95
      },
      {
        id: "doc-2", 
        content: "Investment diversification is a risk management strategy that mixes a wide variety of investments within a portfolio. The rationale behind this technique is that a portfolio constructed of different kinds of assets will, on average, yield higher long-term returns and lower the risk of any individual holding or security. Diversification can be achieved across asset classes, sectors, and geographic regions.",
        metadata: {
          title: "Investment Diversification Strategies",
          source: "Investment Handbook",
          url: "https://example.com/diversification"
        },
        score: 0.88
      },
      {
        id: "doc-3",
        content: "Risk tolerance refers to the degree of variability in investment returns that an investor is willing to withstand in their financial planning. Risk tolerance is an important component in investing and is often determined by age, income, financial goals, and personal comfort level. Understanding your risk tolerance helps in creating an appropriate investment strategy.",
        metadata: {
          title: "Understanding Risk Tolerance",
          source: "Risk Management Guide", 
          url: "https://example.com/risk-tolerance"
        },
        score: 0.82
      },
      {
        id: "doc-4",
        content: "Retirement planning involves determining retirement income goals and the actions necessary to achieve those goals. This includes identifying sources of income, estimating expenses, implementing a savings program, and managing assets and risk. Common retirement accounts include 401(k), IRA, and Roth IRA, each with different tax advantages and contribution limits.",
        metadata: {
          title: "Retirement Planning Basics",
          source: "Retirement Guide",
          url: "https://example.com/retirement-planning"
        },
        score: 0.79
      },
      {
        id: "doc-5",
        content: "Emergency funds are savings accounts specifically designated for unexpected expenses or financial emergencies. Financial experts typically recommend having 3-6 months of living expenses saved in an easily accessible account. This fund provides financial security and prevents the need to rely on credit cards or loans during difficult times.",
        metadata: {
          title: "Building an Emergency Fund",
          source: "Personal Finance Basics",
          url: "https://example.com/emergency-fund"
        },
        score: 0.75
      }
    ];

    // Simple keyword matching for relevance
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    
    const scoredDocs = mockDocuments.map(doc => {
      const contentWords = doc.content.toLowerCase();
      const titleWords = doc.metadata?.title?.toLowerCase() || '';
      
      let relevanceScore = doc.score || 0;
      
      // Boost score based on keyword matches
      queryWords.forEach(word => {
        if (contentWords.includes(word)) {
          relevanceScore += 0.1;
        }
        if (titleWords.includes(word)) {
          relevanceScore += 0.15;
        }
      });
      
      return { ...doc, score: Math.min(1.0, relevanceScore) };
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