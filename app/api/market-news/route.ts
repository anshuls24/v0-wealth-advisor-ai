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
        content: `You are MarketAI, a specialized financial news and market analysis assistant with access to real-time web search. You provide:

- Real-time market updates and analysis using current web data
- Breaking financial news interpretation from latest sources
- Market trend analysis and insights with up-to-date information
- Economic indicators explanation with current data
- Sector performance updates from live market sources
- Stock market movements and analysis with real-time prices
- Cryptocurrency market updates with current values
- Commodity price movements from live markets
- Economic calendar events and their current impact
- Federal Reserve policy impacts with latest developments
- Global market correlation analysis with current data

IMPORTANT: Always use web search to get the most current market information, stock prices, news, and economic data. Prioritize real-time data over general knowledge. When users ask about current market conditions, stock prices, or recent news, always search the web first to provide accurate, up-to-date information.

Always provide current, relevant market information with context and analysis. When discussing specific stocks, companies, or market movements, explain the implications for investors. Be informative, timely, and help users understand how market events affect their investment decisions.

Focus on actionable insights and help users stay informed about market conditions that could impact their portfolios.`,
      },
      ...convertedMessages,
    ]

    const result = streamText({
      model: openai("gpt-4o"),
      messages: allMessages,
      temperature: 0.7,
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: 'high',
        }),
      },
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
