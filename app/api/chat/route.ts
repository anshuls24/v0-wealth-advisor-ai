import { openai } from "@ai-sdk/openai"
import { streamText, convertToModelMessages } from "ai"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    console.log("[v0] Chat API called")
    const { messages } = await req.json()
    console.log("[v0] Received messages:", messages?.length || 0)

    if (!messages || messages.length === 0) {
      console.log("[v0] No messages provided")
      return new Response("No messages provided", { status: 400 })
    }

    const convertedMessages = convertToModelMessages(messages)

    const allMessages = [
      {
        role: "system" as const,
        content: `You are WealthAI, a sophisticated personal wealth advisor and financial planning assistant. You provide expert guidance on:

- Portfolio optimization and asset allocation
- Investment strategies and market analysis  
- Risk assessment and management
- Retirement and financial planning
- Tax optimization strategies
- Market trends and economic insights

Always provide professional, actionable advice while being clear about risks and the importance of diversification. Use specific examples and data when possible. Be conversational but authoritative in your responses.

When users ask about generating charts or visualizations, acknowledge the request and describe what kind of chart would be helpful, but explain that chart generation is a separate feature.`,
      },
      ...convertedMessages,
    ]

    console.log("[v0] Processing", allMessages.length, "messages")

    try {
      const result = streamText({
        model: openai("gpt-4o"),
        messages: allMessages,
        maxTokens: 1000,
        temperature: 0.7,
      })

      console.log("[v0] Streaming response created")
      return result.toUIMessageStreamResponse()
    } catch (streamError: any) {
      console.error("[v0] Streaming error:", streamError)

      // Handle specific OpenAI quota error
      if (streamError?.message?.includes("quota") || streamError?.code === "insufficient_quota") {
        return new Response(
          JSON.stringify({
            error: "OpenAI API quota exceeded. Please check your billing details or try again later.",
            type: "quota_exceeded",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      // Handle other streaming errors
      return new Response(
        JSON.stringify({
          error: "Failed to generate response. Please try again.",
          type: "generation_error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error. Please try again.",
        type: "server_error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
