import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { SYSTEM_INSTRUCTIONS } from "@/components/agent/prompt"
import { 
  ClientProfile, 
  EMPTY_PROFILE
} from "@/lib/profile-schema"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    // Initialize empty profile - profile updates are handled on frontend
    let profile: ClientProfile = EMPTY_PROFILE

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

    // Use simple system prompt - profile management is handled on frontend
    const systemContent = SYSTEM_INSTRUCTIONS

    const allMessages = [
      {
        role: "system" as const,
        content: systemContent,
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