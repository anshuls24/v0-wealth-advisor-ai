import { VectorizeClient } from "@/lib/vectorize"

/**
 * Document retrieval tool for RAG agent
 * Allows the AI to search through the document collection
 */
export const documentRetrievalTool = {
  description: `Search through the financial document collection to find relevant information. Use this tool whenever you need to answer questions about financial topics. The tool will return the most relevant documents based on semantic similarity to your query.`,
  parameters: {
    type: "object" as const,
    properties: {
      query: {
        type: "string" as const,
        description: "The search query to find relevant documents. Be specific and include key terms from the user's question."
      }
    },
    required: ["query"] as const,
    additionalProperties: false as const
  } as const,
  execute: async ({ query }: { query: string }) => {
    // Use a fixed default for document limit
    const documentLimit = 5;
    
    console.log(`🔍 Tool: Retrieving documents for query: "${query}" (limit: ${documentLimit})`)
    
    try {
      // Initialize Vectorize client
      const vectorizeClient = new VectorizeClient(
        process.env.VECTORIZE_PIPELINE_ACCESS_TOKEN || 'mock-token',
        process.env.VECTORIZE_ORGANIZATION_ID || 'mock-org',
        process.env.VECTORIZE_PIPELINE_ID || 'mock-pipeline'
      )

      // Retrieve relevant documents
      const documents = await vectorizeClient.retrieveDocuments(
        query,
        documentLimit,
        0.6 // threshold
      )

      if (documents.length === 0) {
        return {
          success: true,
          documents: [],
          message: "No relevant documents found for this query.",
          count: 0
        }
      }

      // Format documents for the AI
      const formattedDocs = documents.map(doc => ({
        id: doc.id,
        title: doc.metadata?.title || doc.id,
        content: doc.content,
        source: doc.metadata?.source || "Unknown",
        url: doc.metadata?.url,
        relevance_score: doc.score ? (doc.score * 100).toFixed(1) + '%' : 'N/A'
      }))

      console.log(`✅ Tool: Retrieved ${formattedDocs.length} documents`)

      return {
        success: true,
        documents: formattedDocs,
        count: formattedDocs.length,
        message: `Found ${formattedDocs.length} relevant document(s).`
      }
    } catch (error) {
      console.error('❌ Tool: Document retrieval error:', error)
      return {
        success: false,
        documents: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: "Failed to retrieve documents. Please try again."
      }
    }
  }
}
