import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { SYSTEM_INSTRUCTIONS } from "@/components/agent/prompt"
import { ClientProfile, EMPTY_PROFILE, getMissingFields, generateProfileSummary } from "@/lib/profile-schema"
import { extractProfileUpdates, applyProfileUpdates } from "@/lib/profile-extractor"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages, profile: currentProfile } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    // Initialize profile if not provided
    let profile: ClientProfile = currentProfile || EMPTY_PROFILE

    // Extract profile information from the latest user message
    const latestUserMessage = messages[messages.length - 1]
    if (latestUserMessage && latestUserMessage.role === 'user') {
      let userContent = ""
      if (latestUserMessage.parts && Array.isArray(latestUserMessage.parts)) {
        userContent = latestUserMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('')
      } else if (latestUserMessage.content) {
        userContent = latestUserMessage.content
      } else if (latestUserMessage.text) {
        userContent = latestUserMessage.text
      }
      
      // Extract and apply profile updates
      const updates = extractProfileUpdates(userContent, profile)
      profile = applyProfileUpdates(profile, updates)
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

    // Generate profile summary for system prompt
    const profileSummary = generateProfileSummary(profile)
    const missingFields = getMissingFields(profile)
    
    // Add system message with profile management
    const allMessages = [
      {
        role: "system" as const,
        content: `${SYSTEM_INSTRUCTIONS}

IMPORTANT PROFILE MANAGEMENT:
You must continue asking clarifying and follow-up questions until you have filled ALL fields in the client profile (goals, risk, financial situation, time horizon, preferences, expectations).  
Never assume missing information — always ask.  
If the client gives incomplete or vague answers, politely ask for clarification.  
When you finish one section, summarize and move on to the next missing section.  
Stop only once the profile is fully complete.

CURRENT PROFILE STATUS:
${profileSummary}

MISSING FIELDS: ${missingFields.length > 0 ? missingFields.join(', ') : 'None - Profile Complete!'}

Continue gathering information for missing fields. Focus on the next most important missing piece of information.`,
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
