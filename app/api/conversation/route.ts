import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"
import { SYSTEM_INSTRUCTIONS } from "@/components/agent/prompt"
import { 
  ClientProfile, 
  EMPTY_PROFILE,
  generateFinalProfileSummary,
  isProfileComplete,
  getProfileCompletionPercentage
} from "@/lib/profile-schema"
import { extractProfileUpdates, applyProfileUpdates } from "@/lib/profile-extractor"
import { retrieveDocumentsTool } from "@/components/agent/tools/retrieve-documents"
import { getPolygonMCPClient } from "@/lib/mcp"

// Initialize OpenAI with explicit API key for production environments
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { messages, userId, profile: clientProfile } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    // Check if this is the first user message (only user message in array)
    const userMessages = messages.filter((msg: any) => msg.role === 'user')
    const isFirstUserMessage = userMessages.length === 1

    // Use client-provided profile or empty profile
    let currentProfile: ClientProfile = clientProfile || EMPTY_PROFILE;

    // Extract profile updates from the latest user message (like booking-agent-ts)
    const latestMessage = messages[messages.length - 1];
    let profileUpdates: {
      updates: any[];
      profile: ClientProfile;
      fieldsUpdated: string[];
      confidence: number;
    } | null = null;
    let updatedProfile: ClientProfile = currentProfile;
    
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
        const updates = extractProfileUpdates(userContent, currentProfile);
        
        if (updates.length > 0) {
          console.log('✅ Server extracted profile updates:', updates);
          updatedProfile = applyProfileUpdates(currentProfile, updates);
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

    // Build system prompt with profile context
    let systemContent = SYSTEM_INSTRUCTIONS

    // Check if profile is complete
    const profileComplete = isProfileComplete(updatedProfile);
    const profilePercentage = getProfileCompletionPercentage(updatedProfile);

    // Add current profile context if available
    if (currentProfile && (currentProfile.goals.short_term || currentProfile.risk.tolerance)) {
      systemContent += `\n\n## CURRENT USER PROFILE:\n${generateFinalProfileSummary(currentProfile)}\n\nProfile Completion: ${profilePercentage}%\n\nUse this profile information to tailor your questions and recommendations. Reference their previous answers naturally.`
    }

    // If profile just became complete (>=75%), trigger summary and recommendations
    if (profilePercentage >= 75 && !isFirstUserMessage) {
      systemContent += `\n\n## PROFILE COMPLETION MILESTONE REACHED (${profilePercentage}%)

IMPORTANT: The user's profile is now sufficiently complete. Follow this sequence:

1. **Acknowledge their completion**: "Great! Your trading profile is now ${profilePercentage}% complete."

2. **Provide a structured summary** using this format:
   ## 📋 Your Options Trading Profile Summary
   
   ### 🎯 Goals
   [List their goals]
   
   ### ⚖️ Risk Profile
   [List risk tolerance and experience]
   
   ### 💰 Trading Parameters
   [List capital, time horizon, preferences]
   
   ### 🎨 Options Preferences
   [List strategy preferences, underlyings, IV comfort, etc.]

3. **Ask for confirmation**: "Does this look accurate? Would you like to modify anything?"
   [BUTTONS: Looks good | Edit goals | Edit risk | Edit preferences]

4. **ONLY AFTER they confirm**, offer these next steps:
   - Recommend specific strategies based on their profile
   - Analyze current market opportunities
   - Provide educational content on their preferred strategies
   - Set up a watchlist for their preferred underlyings

Do NOT skip the confirmation step. Wait for explicit approval before giving strategy recommendations.`
    }

    // If profile is confirmed complete (100%), enable recommendation mode
    if (profileComplete && !isFirstUserMessage) {
      systemContent += `\n\n## RECOMMENDATION MODE ENABLED

The user's profile is COMPLETE and CONFIRMED. You can now:
- Recommend specific option strategies (use retrieveKnowledgeBase tool for strategy details)
- Analyze tickers using Polygon MCP tools (get_snapshot_ticker, list_ticker_news, etc.)
- Provide personalized trade ideas based on their profile
- Explain strategies in depth tailored to their experience level

Always reference their profile when making recommendations:
- Risk tolerance: ${updatedProfile.risk.tolerance}
- Experience: ${updatedProfile.options?.experience_level || 'unknown'}
- Strategy preference: ${updatedProfile.options?.strategy_preference || 'none specified'}
- Preferred underlyings: ${updatedProfile.options?.preferred_underlyings?.join(', ') || 'none specified'}

Use tools proactively:
- Call Polygon MCP tools for market data
- Call retrieveKnowledgeBase for strategy education
- Combine both for comprehensive recommendations`
    }

    // If this is the first user message, add special instructions for welcome message
    if (isFirstUserMessage) {
      systemContent += `\n\nIMPORTANT: This is the user's first message. Start your response with a warm welcome that explains:
1. You're an options strategist AI helping them design strategies matched to their style and goals
2. You'll build a Trading Profile together before suggesting any strategy
3. They can track their profile completion progress in the left sidebar
4. Ask them to start by sharing their main goal when trading options

Be friendly, professional, and encouraging. Then proceed to ask your first discovery question about their goals with button options.`
    }

    const allMessages = [
      {
        role: "system" as const,
        content: systemContent,
      },
      ...convertedMessages,
    ]

    // Initialize tools: Polygon MCP + RAG
    let tools: Record<string, any> = {
      retrieveKnowledgeBase: retrieveDocumentsTool,
    };

    // Try to add Polygon MCP tools if available (Railway only)
    if (process.env.NODE_ENV === 'production') {
      try {
        const polygonClient = getPolygonMCPClient();
        await polygonClient.connect();
        const polygonTools = await polygonClient.getTools();
        tools = { ...tools, ...polygonTools };
        console.log(`✅ Conversation: Added ${Object.keys(polygonTools).length} Polygon tools`);
      } catch (err) {
        console.warn('⚠️ Conversation: Polygon MCP unavailable, using RAG only:', err);
      }
    }

    const result = streamText({
      model: openai("gpt-4o-mini"),
      messages: allMessages,  
      temperature: 0.7,
      tools,
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