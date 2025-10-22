// RAG Chat API endpoint - following typescript-next-starter pattern
// Uses tools for document retrieval with proper AI SDK streaming

import { createOpenAI } from "@ai-sdk/openai"
import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { RAG_SYSTEM_INSTRUCTIONS } from "@/components/agent/rag-prompt"
import { retrieveDocumentsTool } from "@/components/agent/tools"
import { NextRequest } from "next/server"

// Initialize OpenAI with explicit API key for production environments
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    console.log('🔥 RAG API: Request received');
    const { messages } = await request.json();
    console.log('🔥 RAG API: Messages received:', messages?.length || 0, 'messages');

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("Messages array is required", { status: 400 })
    }

    console.log('🤖 Using RAG agent with document retrieval tool')

    // Convert UI messages to model messages format
    const modelMessages = convertToModelMessages(messages)

    // Stream the response with tools - CRITICAL: stopWhen makes this an agent!
    const result = streamText({
      model: openai("gpt-4o"),
      system: RAG_SYSTEM_INSTRUCTIONS,
      messages: modelMessages,
      temperature: 0.1,
      stopWhen: stepCountIs(10), // ⚡ THIS MAKES IT AN AGENT!
      tools: {
        retrieveKnowledgeBase: retrieveDocumentsTool, // Match reference naming
      },
    })

    // Return UI message stream response (compatible with useChat transport)
    return result.toUIMessageStreamResponse()

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
