import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"
import { SYSTEM_INSTRUCTIONS } from "@/components/agent/prompt"
import { 
  ClientProfile, 
  EMPTY_PROFILE
} from "@/lib/profile-schema"
import { extractProfileUpdates, applyProfileUpdates } from "@/lib/profile-extractor"

// Initialize OpenAI with explicit API key for production environments
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    // Check if this is the first user message (only user message in array)
    const userMessages = messages.filter((msg: any) => msg.role === 'user')
    const isFirstUserMessage = userMessages.length === 1

    // Extract profile updates from the latest user message (like booking-agent-ts)
    const latestMessage = messages[messages.length - 1];
    let profileUpdates: {
      updates: any[];
      profile: ClientProfile;
      fieldsUpdated: string[];
      confidence: number;
    } | null = null;
    let updatedProfile: ClientProfile = EMPTY_PROFILE;
    
    if (latestMessage?.role === 'user') {
      // Extract user content (similar to booking-agent's city extraction)
      let userContent = "";
      if (latestMessage.parts && Array.isArray(latestMessage.parts)) {
        userContent = latestMessage.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');
      } else if (latestMessage.content) {
        userContent = latestMessage.content;
      } else if (latestMessage.text) {
        userContent = latestMessage.text;
      }

      if (userContent && userContent.trim().length > 0) {
        console.log('🔍 Server-side profile extraction from:', userContent);
        
        // Extract profile updates (like booking-agent extracts weather/destination data)
        const updates = extractProfileUpdates(userContent, EMPTY_PROFILE);
        
        if (updates.length > 0) {
          console.log('✅ Server extracted profile updates:', updates);
          updatedProfile = applyProfileUpdates(EMPTY_PROFILE, updates);
          profileUpdates = {
            updates,
            profile: updatedProfile,
            fieldsUpdated: updates.map(u => u.field),
            confidence: updates.reduce((sum, u) => sum + u.confidence, 0) / updates.length
          };
        }
      }
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

    // Use simple system prompt - profile management is handled on frontend
    let systemContent = SYSTEM_INSTRUCTIONS

    // If this is the first user message, add special instructions for welcome message
    if (isFirstUserMessage) {
      systemContent += `\n\nIMPORTANT: This is the user's first message. Start your response with a warm welcome that explains:
1. You're here to provide personalized financial advice
2. You need to complete their financial profile first before giving specific recommendations
3. They can track their profile completion progress in the left sidebar
4. Ask them to start by sharing their financial goals

Be friendly, professional, and encouraging. Then proceed to ask your first discovery question about their goals.`
    }

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

    // Log profile updates for client to pick up (simpler approach than stream injection)
    if (profileUpdates) {
      console.log('📡 Server-side profile updates available:', profileUpdates);
      // Store in a simple way that client can access - for now just log
      // In a real app, you might store this in Redis or a database with the userId
    }

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