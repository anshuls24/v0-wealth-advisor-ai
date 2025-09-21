import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { SYSTEM_INSTRUCTIONS } from "@/components/agent/prompt"
import { 
  ClientProfile, 
  EMPTY_PROFILE, 
  getMissingFields, 
  generateProfileSummary, 
  isProfileComplete,
  generateEditableProfileSummary 
} from "@/lib/profile-schema"
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
    const profileIsComplete = isProfileComplete(profile)
    
    // Check if this is the first time the profile became complete
    const wasProfileComplete = isProfileComplete(currentProfile || EMPTY_PROFILE)
    const justCompleted = profileIsComplete && !wasProfileComplete
    
    // Add system message with profile management
    let systemContent = `${SYSTEM_INSTRUCTIONS}

IMPORTANT PROFILE MANAGEMENT:
You must continue asking clarifying and follow-up questions until you have filled ALL fields in the client profile (goals, risk, financial situation, time horizon, preferences, expectations).  
Never assume missing information — always ask.  
If the client gives incomplete or vague answers, politely ask for clarification.  
When you finish one section, summarize and move on to the next missing section.  
Stop only once the profile is fully complete.

CURRENT PROFILE STATUS:
${profileSummary}

MISSING FIELDS: ${missingFields.length > 0 ? missingFields.join(', ') : 'None - Profile Complete!'}

Continue gathering information for missing fields. Focus on the next most important missing piece of information.`

    // If profile just became complete, provide editable summary
    if (justCompleted) {
      systemContent = `${SYSTEM_INSTRUCTIONS}

🎉 PROFILE COMPLETE - PROVIDE EDITABLE SUMMARY:
The client's financial profile is now complete! You must now provide a comprehensive, editable summary for the client to review and verify.

CRITICAL INSTRUCTIONS:
1. Present the complete profile summary in a clear, organized format
2. Ask the client to verify each section for accuracy
3. Allow them to request corrections or additions
4. Only proceed to recommendations AFTER they confirm the summary is accurate
5. Be patient and thorough - this verification step is crucial

COMPLETE PROFILE DATA:
${generateEditableProfileSummary(profile)}

Provide the summary above and ask the client to review it carefully. Wait for their confirmation before proceeding to investment recommendations.`
    }
    
    // If profile is already complete and user is confirming/editing
    if (profileIsComplete && wasProfileComplete) {
      // Check if user is confirming the summary or requesting changes
      const latestMessage = convertedMessages[convertedMessages.length - 1]?.content?.toLowerCase() || ""
      const isConfirming = latestMessage.includes('confirm') || latestMessage.includes('correct') || latestMessage.includes('accurate') || latestMessage.includes('yes')
      const isRequestingChanges = latestMessage.includes('change') || latestMessage.includes('modify') || latestMessage.includes('update') || latestMessage.includes('edit')
      
      if (isConfirming) {
        systemContent = `${SYSTEM_INSTRUCTIONS}

✅ PROFILE CONFIRMED - PROVIDE RECOMMENDATIONS:
The client has confirmed their financial profile is accurate. Now provide comprehensive, personalized investment recommendations.

COMPLETE PROFILE DATA:
${generateEditableProfileSummary(profile)}

PROVIDE:
1. Personalized investment strategy based on their profile
2. Specific asset allocation recommendations
3. Risk-adjusted return expectations
4. Implementation timeline and steps
5. Ongoing monitoring and rebalancing plan
6. Next steps for getting started

Be specific, actionable, and professional in your recommendations.`
      } else if (isRequestingChanges) {
        systemContent = `${SYSTEM_INSTRUCTIONS}

📝 PROFILE UPDATES REQUESTED:
The client wants to modify their profile information. Help them update the specific sections they mentioned.

CURRENT PROFILE DATA:
${generateEditableProfileSummary(profile)}

Ask them specifically what they'd like to change and update the profile accordingly. Once updated, provide the revised summary for confirmation.`
      } else {
        systemContent = `${SYSTEM_INSTRUCTIONS}

📋 PROFILE COMPLETE - AWAITING CONFIRMATION:
The client's profile is complete but they haven't confirmed it yet. Remind them to review the summary and confirm if it's accurate.

COMPLETE PROFILE DATA:
${generateEditableProfileSummary(profile)}

Ask them to review the summary and confirm if everything is correct, or let you know what needs to be changed.`
      }
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