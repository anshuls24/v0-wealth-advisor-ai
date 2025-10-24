import { tool } from "ai";
import { z } from "zod";
import { VectorizeService } from "@/lib/retrieval/vectorize";
import { ClientProfile } from "@/lib/profile-schema";

/**
 * Create a profile-aware RAG tool that injects user profile context into queries
 * @param userProfile - The user's ClientProfile (optional, can be null/undefined)
 */
export function createRetrieveDocumentsTool(userProfile?: ClientProfile | null) {
  return tool({
    description:
      "Search the financial knowledge base for information about financial planning, investing, retirement, tax strategies, and wealth management topics. Results are automatically filtered based on the user's profile (risk tolerance, experience level, preferences).",
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
        console.log(`👤 RAG Tool: User Profile Received:`, {
          hasProfile: !!userProfile,
          riskTolerance: userProfile?.risk?.tolerance || 'unknown',
          experience: userProfile?.options?.experience_level || 'unknown',
          strategyPref: userProfile?.options?.strategy_preference || 'unknown',
          preferredUnderlyings: userProfile?.options?.preferred_underlyings || [],
        });
        
        // Enhance query with profile context for better retrieval
        let enhancedQuery = query;
        if (userProfile) {
          const profileContext: string[] = [];
          
          if (userProfile.risk?.tolerance) {
            profileContext.push(`risk_tolerance:${userProfile.risk.tolerance}`);
          }
          if (userProfile.options?.experience_level) {
            profileContext.push(`experience:${userProfile.options.experience_level}`);
          }
          if (userProfile.options?.strategy_preference) {
            profileContext.push(`strategy:${userProfile.options.strategy_preference}`);
          }
          
          if (profileContext.length > 0) {
            enhancedQuery = `${query} [${profileContext.join(' ')}]`;
            console.log(`🎯 RAG Tool: Enhanced query with profile: "${enhancedQuery}"`);
          }
        }
        
        const vectorizeService = new VectorizeService();
        const documents = await vectorizeService.retrieveDocuments(enhancedQuery, 5);

        if (!documents || documents.length === 0) {
          return {
            context: "No relevant information found in the knowledge base.",
            sources: [],
            chatSources: [],
            profileContext: userProfile ? `User Profile: Risk=${userProfile.risk?.tolerance}, Experience=${userProfile.options?.experience_level}` : null,
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
        let context = vectorizeService.formatDocumentsForContext(documents);
        
        // Append profile context to help AI tailor the response
        if (userProfile) {
          context += `\n\n--- USER PROFILE CONTEXT ---\n`;
          context += `Risk Tolerance: ${userProfile.risk?.tolerance || 'unknown'}\n`;
          context += `Options Experience: ${userProfile.options?.experience_level || 'unknown'}\n`;
          if (userProfile.options?.strategy_preference) {
            context += `Preferred Strategy: ${userProfile.options.strategy_preference}\n`;
          }
          if (userProfile.options?.preferred_underlyings && userProfile.options.preferred_underlyings.length > 0) {
            context += `Preferred Underlyings: ${userProfile.options.preferred_underlyings.join(', ')}\n`;
          }
          context += `\nIMPORTANT: Tailor your response to match this user's profile. Only recommend strategies appropriate for their risk level and experience.`;
        }

        console.log(`✅ RAG Tool: Retrieved ${documents.length} documents with profile context`);

        return {
          context,
          sources: aiSdkSources,
          chatSources: chatSources,
          profileContext: userProfile ? `Risk=${userProfile.risk?.tolerance}, Experience=${userProfile.options?.experience_level}` : null,
        };
      } catch (error) {
        console.error(`💥 RAG Tool error:`, error);
        throw error;
      }
    },
  });
}

// Export default tool without profile for backward compatibility
export const retrieveDocumentsTool = createRetrieveDocumentsTool();

