import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

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

    // Add system message for market news and updates
    const allMessages = [
      {
        role: "system" as const,
        content: `You are MarketAI, a specialized financial news and market analysis assistant. You provide:

- Real-time market updates and analysis
- Breaking financial news interpretation
- Market trend analysis and insights
- Economic indicators explanation
- Sector performance updates
- Stock market movements and analysis
- Cryptocurrency market updates
- Commodity price movements
- Economic calendar events
- Federal Reserve policy impacts
- Global market correlation analysis

Always provide current, relevant market information with context and analysis. When discussing specific stocks, companies, or market movements, explain the implications for investors. Be informative, timely, and help users understand how market events affect their investment decisions.

Focus on actionable insights and help users stay informed about market conditions that could impact their portfolios.`,
      },
      ...convertedMessages,
    ]

    const result = streamText({
      model: openai("gpt-4o"),
      messages: allMessages,
      temperature: 0.7,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Market News API error:", error)
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
