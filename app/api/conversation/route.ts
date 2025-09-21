import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { SYSTEM_INSTRUCTIONS } from "@/components/agent/prompt"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    // Convert messages to the format expected by OpenAI
    const convertedMessages = messages.map((msg: any) => {
      // Extract text from parts if it exists, otherwise use content
      let content = ""
      if (msg.parts && Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('')
      } else if (msg.content) {
        content = msg.content
      } else if (msg.text) {
        content = msg.text
      }

      return {
        role: msg.role,
        content: content,
      }
    })

    // Add system message
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

    const result = streamText({
      model: openai("gpt-4o"),
      system: SYSTEM_INSTRUCTIONS,
      messages: allMessages,  
      temperature: 0.7,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Conversation API error:", error)
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
