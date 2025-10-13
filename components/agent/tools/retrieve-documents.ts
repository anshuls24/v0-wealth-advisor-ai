import { tool } from "ai";
import { z } from "zod";
import { VectorizeService } from "@/lib/retrieval/vectorize";

export const retrieveDocumentsTool = tool({
  description:
    "Search the financial knowledge base for information about financial planning, investing, retirement, tax strategies, and wealth management topics",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Search query for financial information - be specific and include key terms from the user's question"
      ),
  }),
  execute: async ({ query }) => {
    try {
      console.log(`🔍 RAG Tool: Executing document retrieval for: "${query}"`);
      
      const vectorizeService = new VectorizeService();
      const documents = await vectorizeService.retrieveDocuments(query, 5);

      if (!documents || documents.length === 0) {
        return {
          context: "No relevant information found in the knowledge base.",
          sources: [],
          chatSources: [],
        };
      }

      // Convert documents to chat sources
      const chatSources = vectorizeService.convertDocumentsToChatSources(documents);

      // Format sources for AI SDK source parts
      const aiSdkSources = chatSources.map((source, index) => ({
        sourceType: "url" as const,
        id: `vectorize-source-${Date.now()}-${index}`,
        url: source.url,
        title: source.title || "Financial Knowledge Base Source",
      }));

      // Format context for the AI to read
      const context = vectorizeService.formatDocumentsForContext(documents);

      console.log(`✅ RAG Tool: Retrieved ${documents.length} documents successfully`);

      return {
        context,
        sources: aiSdkSources,
        chatSources: chatSources,
      };
    } catch (error) {
      console.error(`💥 RAG Tool error:`, error);
      throw error;
    }
  },
});

