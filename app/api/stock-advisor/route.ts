import { createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { NextRequest } from "next/server";
import { STOCK_ADVISOR_SYSTEM_PROMPT } from "@/components/agent/stock-advisor-prompt";
import { getPolygonMCPClient } from "@/lib/mcp";
import { retrieveDocumentsTool } from "@/components/agent/tools/retrieve-documents";

// Initialize OpenAI with explicit API key for production environments
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Allow streaming responses up to 60 seconds for complex analysis
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("Messages array is required", { status: 400 });
    }

    console.log("\n💼 ============================================");
    console.log("💼 STOCK ADVISOR AGENT REQUEST RECEIVED");
    console.log("💼 ============================================");

    const modelMessages = convertToModelMessages(messages);

    // Initialize Polygon MCP client
    console.log("🚀 Initializing Polygon MCP client...");
    const polygonClient = getPolygonMCPClient();
    await polygonClient.connect();

    // Retrieve Polygon tools
    const polygonTools = await polygonClient.getTools();

    console.log(
      `\n🔧 Polygon tools retrieved: ${Object.keys(polygonTools).length} tools`
    );
    console.log(`📋 Available tools: ${Object.keys(polygonTools).join(", ")}`);

    // Combine Polygon tools with RAG and web search
    const allTools = {
      ...polygonTools, // All Polygon.io financial data tools
      retrieveKnowledgeBase: retrieveDocumentsTool, // RAG for trading strategies/education
      web_search: openai.tools.webSearch({
        searchContextSize: "low",
      }),
    };

    console.log(`\n🔧 Agent has access to ${Object.keys(allTools).length} total tools:`);
    console.log(`   - Polygon.io tools: ${Object.keys(polygonTools).length}`);
    console.log(`   - Knowledge base: retrieveKnowledgeBase`);
    console.log(`   - Web search: web_search`);

    // Wrap all tools with logging to track agent decisions
    const wrappedTools = Object.fromEntries(
      Object.entries(allTools).map(([toolName, toolDef]) => [
        toolName,
        {
          ...toolDef,
          execute: async (args: any, options: any) => {
            console.log(`\n🔧 ========================================`);
            console.log(`🔧 Tool Called: ${toolName}`);
            console.log(`🔧 ========================================`);
            console.log(`📥 Input:`, JSON.stringify(args, null, 2));

            const startTime = Date.now();
            try {
              const result = toolDef.execute
                ? await toolDef.execute(args, options)
                : null;
              const duration = Date.now() - startTime;

              console.log(`✅ Success (${duration}ms)`);
              console.log(
                `📤 Output:`,
                JSON.stringify(result, null, 2).substring(0, 500) +
                  (JSON.stringify(result).length > 500 ? "..." : "")
              );

              return result;
            } catch (error) {
              const duration = Date.now() - startTime;
              console.log(`❌ Error (${duration}ms):`, error);
              throw error;
            }
          },
        },
      ])
    );

    console.log("\n🧠 Starting agentic conversation with multi-step reasoning...\n");

    // Stream text with agentic tool calling
    const result = streamText({
      model: openai("gpt-4o-mini"), // Using gpt-4o-mini for higher rate limits and lower cost
      system: STOCK_ADVISOR_SYSTEM_PROMPT,
      messages: modelMessages,
      tools: wrappedTools,
      stopWhen: stepCountIs(15), // Allow up to 15 steps for complex analysis
      // The agent can make multiple autonomous tool calls per turn
      // AI SDK 5.0 handles tool calling loops automatically
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("\n💥 ========================================");
    console.error("💥 STOCK ADVISOR AGENT ERROR");
    console.error("💥 ========================================");
    console.error("Error details:", error);

    // Handle specific error types
    if (error instanceof Error) {
      // MCP connection errors
      if (
        error.message.includes("Polygon") ||
        error.message.includes("MCP") ||
        error.message.includes("uvx")
      ) {
        console.error(
          "⚠️ Polygon MCP connection error - agent will operate with limited tools"
        );
        return new Response(
          JSON.stringify({
            error:
              "Market data tools temporarily unavailable. Knowledge base and web search still available.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      // API key errors
      if (
        error.message.includes("POLYGON_API_KEY") ||
        error.message.includes("API key")
      ) {
        return new Response(
          JSON.stringify({
            error: "Market data configuration error. Please contact support.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Network or API errors
      if (
        error.message.includes("network") ||
        error.message.includes("timeout")
      ) {
        return new Response(
          JSON.stringify({
            error: "Network error. Please check your connection and try again.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      // Rate limiting errors
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        return new Response(
          JSON.stringify({
            error:
              "Service is temporarily unavailable. Please try again in a moment.",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Generic error fallback
    return new Response(
      JSON.stringify({
        error: "Failed to generate response. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

