// RAG Chat API endpoint
// Based on https://github.com/trancethehuman/rag-next-typescript

import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { VectorizeClient } from "@/lib/vectorize"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    console.log('🔥 RAG API: Request received');
    const { messages } = await req.json()
    console.log('🔥 RAG API: Messages received:', JSON.stringify(messages, null, 2));

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    // Get the latest user message for document retrieval
    const latestMessage = messages[messages.length - 1]
    if (!latestMessage || latestMessage.role !== 'user') {
      return new Response("Invalid message format", { status: 400 })
    }

    const userQuery = latestMessage.content || latestMessage.text || ''
    if (!userQuery.trim()) {
      return new Response("Empty query provided", { status: 400 })
    }

    console.log('🔥 RAG API: Processing query:', userQuery)

    // Initialize Vectorize client and retrieve relevant documents
    const vectorizeClient = new VectorizeClient(
      process.env.VECTORIZE_PIPELINE_ACCESS_TOKEN || 'mock-token',
      process.env.VECTORIZE_ORGANIZATION_ID || 'mock-org',
      process.env.VECTORIZE_PIPELINE_ID || 'mock-pipeline'
    )
    
    let retrievedDocuments: any[] = []
    let contextText = ''
    let documentSources: { id: string; title: string; url?: string; score?: number }[] = []

    try {
      retrievedDocuments = await vectorizeClient.retrieveDocuments(
        userQuery,
        5, // limit
        0.6 // threshold (slightly lower to ensure sources appear)
      )

    contextText = vectorizeClient.formatDocumentsAsContext(retrievedDocuments)
    documentSources = retrievedDocuments.map(doc => ({
      id: doc.id,
      title: doc.metadata?.title || doc.id,
      url: doc.metadata?.url,
      score: doc.score
    }))

    console.log(`📚 Retrieved ${retrievedDocuments.length} relevant documents`)
    console.log('📄 Document sources:', documentSources.map(s => s.title))
    console.log('📝 Context text being sent to AI:')
    console.log(contextText)

    } catch (error) {
      console.error('Document retrieval error:', error)
      // Continue without context if retrieval fails
      contextText = 'No documents could be retrieved at this time.'
    }

    // Handle greetings with a hardcoded response to prevent any AI contamination
    const isGenericGreeting = /^(hi|hello|hey|howdy|yo|sup|start|help)\b/i.test(userQuery.trim())
      || userQuery.trim().length < 4
      || !/[a-zA-Z]/.test(userQuery)

    if (isGenericGreeting) {
      // Return hardcoded response immediately for greetings - no AI involved
      return new Response(
        JSON.stringify({
          message: "Ask a question about your documents and I'll retrieve relevant information and cite sources.",
          role: "assistant",
          id: "rag-greeting-" + Date.now(),
          createdAt: new Date().toISOString(),
          content: "Ask a question about your documents and I'll retrieve relevant information and cite sources.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Assistant": "rag",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Helpful document retrieval system prompt
    const systemPrompt = `You are a financial document assistant. Answer questions using ONLY the provided documents below.

RETRIEVED DOCUMENTS:
${contextText}

INSTRUCTIONS:
1. Use ONLY the information from the documents above to answer questions
2. If the documents contain relevant information, provide a comprehensive answer citing the document titles
3. Connect related concepts from multiple documents when relevant (e.g., "wealth management" encompasses financial planning, investment diversification, risk management, etc.)
4. If documents truly don't contain relevant information, say "The provided documents don't contain information about [topic]"
5. Be helpful and informative while staying factual
6. NO greetings, onboarding, or profile-building questions

Answer the user's question using the document content above.`

    console.log('🤖 Final system prompt being sent to AI:')
    console.log(systemPrompt)
    console.log('🔍 User query being sent to AI:', userQuery)

    // Use ONLY the latest user query - completely isolated from any other context
    const allMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "user" as const,
        content: userQuery,
      },
    ]

    // Stream the response
    const result = streamText({
      model: openai("gpt-4o-mini"),
      messages: allMessages,
      temperature: 0.3, // Lower temperature for more factual responses
    })

    // Add document sources to the response headers for the client to access
    const response = result.toUIMessageStreamResponse()
    
    // Add custom headers with document sources
    if (documentSources.length > 0) {
      response.headers.set('X-Document-Sources', JSON.stringify(documentSources))
    }
    response.headers.set('X-Assistant', 'rag')
    response.headers.set('Cache-Control', 'no-store')

    return response

  } catch (error) {
    console.error("RAG Chat API error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error. Please try again.",
        type: "server_error",
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
