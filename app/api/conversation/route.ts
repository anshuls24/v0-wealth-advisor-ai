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
import { ProfileStore } from "@/lib/profile-store"
import { createRetrieveDocumentsTool } from "@/components/agent/tools/retrieve-documents"
import { getPolygonMCPClient } from "@/lib/mcp"

// Initialize OpenAI with explicit API key for production environments
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    console.log('🚀 ========== CONVERSATION API START ==========');
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('🔑 API Keys Status:', {
      openai: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
      polygon: process.env.POLYGON_API_KEY ? '✅ Set' : '❌ Missing',
      vectorize_token: process.env.VECTORIZE_PIPELINE_ACCESS_TOKEN ? '✅ Set' : '❌ Missing',
      vectorize_org: process.env.VECTORIZE_ORGANIZATION_ID ? '✅ Set' : '❌ Missing',
      vectorize_pipeline: process.env.VECTORIZE_PIPELINE_ID ? '✅ Set' : '❌ Missing',
    });
    
    const { messages, userId, profile: clientProfile } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    // Check if this is the first user message (only user message in array)
    const userMessages = messages.filter((msg: any) => msg.role === 'user')
    const isFirstUserMessage = userMessages.length === 1

    // Merge client-provided profile with any server-stored profile for this user
    let currentProfile: ClientProfile = ProfileStore.merge(userId, clientProfile || undefined);

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

    // Initialize tools: Profile-aware RAG + Polygon MCP
    console.log('🔧 Conversation: Initializing tools with user profile...');
    console.log('👤 Conversation: Profile being injected:', {
      hasProfile: !!updatedProfile,
      riskTolerance: updatedProfile?.risk?.tolerance || 'unknown',
      experience: updatedProfile?.options?.experience_level || 'unknown',
      strategyPref: updatedProfile?.options?.strategy_preference || 'unknown',
      completion: profilePercentage + '%',
    });
    
    // Persist updated profile for this userId
    try {
      if (userId) {
        ProfileStore.set(userId, updatedProfile);
      }
    } catch (e) {
      console.warn('⚠️ Failed to persist profile in ProfileStore:', e instanceof Error ? e.message : e);
    }

    // Create profile-aware RAG tool with merged profile
    const profileAwareRAGTool = createRetrieveDocumentsTool(updatedProfile);
    
    let tools: Record<string, any> = {
      retrieveKnowledgeBase: profileAwareRAGTool,
    };
    
    let mcpAvailable = false;

    // Try to add Polygon MCP tools if available (Railway only)
    // Add timeout to prevent hanging
    if (process.env.NODE_ENV === 'production') {
      console.log('🏭 Production mode detected - attempting to load Polygon MCP tools...');
      try {
        // Add 5-second timeout for MCP connection (reduced from 10s)
        const mcpPromise = (async () => {
          const polygonClient = getPolygonMCPClient();
          console.log('🔌 Connecting to Polygon MCP server...');
          await polygonClient.connect();
          console.log('✅ Polygon MCP connected, fetching tools...');
          const polygonTools = await polygonClient.getTools();
          return polygonTools;
        })();

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MCP connection timeout (5s)')), 5000)
        );

        const polygonTools = await Promise.race([mcpPromise, timeoutPromise]) as Record<string, any>;
        
        tools = { ...tools, ...polygonTools };
        mcpAvailable = true;
        console.log(`✅ Conversation: Added ${Object.keys(polygonTools).length} Polygon MCP tools`);
        console.log(`📋 Available MCP tools:`, Object.keys(polygonTools).join(', '));
        console.log(`📋 Conversation: Total tools available: ${Object.keys(tools).length} (RAG + MCP)`);
        console.log(`📋 All tools:`, Object.keys(tools).join(', '));
      } catch (err) {
        console.error('❌ Conversation: Polygon MCP connection failed:', err);
        console.error('❌ Error details:', err instanceof Error ? err.message : String(err));
        console.warn('⚠️ Conversation: Falling back to profile-aware RAG only');
        console.warn('⚠️ This is OK - RAG will still work for strategy recommendations');
      }
    } else {
      console.log(`💻 Development mode - using profile-aware RAG tool only (MCP requires Railway)`);
    }
    
    // Add tool availability info to system prompt
    if (!mcpAvailable) {
      systemContent += `\n\n⚠️ IMPORTANT SYSTEM INFO: Real-time market data tools (Polygon MCP) are currently unavailable. You ONLY have access to the retrieveKnowledgeBase tool. When users ask about specific tickers or market analysis:
1. DO NOT say "I'll gather market data" or "Please hold on for market data"
2. IMMEDIATELY acknowledge that real-time data is unavailable
3. IMMEDIATELY use retrieveKnowledgeBase to provide strategy education
4. Focus on teaching strategies suitable for their profile and the ticker type they mentioned
5. Provide value through education, not through pretending to fetch unavailable data

Example response: "While I can't access real-time market data for QQQ right now, I can help you understand the best options strategies for tech-heavy ETFs like QQQ based on your profile. Let me retrieve some strategy information for you." Then IMMEDIATELY call retrieveKnowledgeBase.`;
    }

    const result = streamText({
      model: openai("gpt-4o-mini"),
      messages: allMessages,  
      temperature: 0.7,
      tools,
      onStepFinish: (step) => {
        console.log('📊 ========== STEP FINISHED ==========');
        
        // Log tool usage with profile context
        if (step.toolCalls && step.toolCalls.length > 0) {
          console.log('🔧 Tools called in this step:', step.toolCalls.length);
          step.toolCalls.forEach((tc, idx) => {
            console.log(`  [${idx + 1}] Tool: ${tc.toolName}`);
            try {
              if (tc.args === undefined || tc.args === null) {
                console.log(`      Args: [${tc.args === undefined ? 'undefined' : 'null'}]`);
              } else {
                const argsStr = JSON.stringify(tc.args);
                if (typeof argsStr === 'string') {
                  const preview = argsStr.length > 200 ? argsStr.substring(0, 200) + '...' : argsStr;
                  console.log(`      Args:`, preview);
                } else {
                  console.log(`      Args: [unserializable]`);
                }
              }
            } catch (e) {
              console.log(`      Args: [Could not stringify - ${e instanceof Error ? e.message : 'unknown error'}]`);
            }
          });
          console.log('👤 Profile context for these tools:', {
            riskTolerance: updatedProfile?.risk?.tolerance || 'unknown',
            experience: updatedProfile?.options?.experience_level || 'unknown',
            strategyPref: updatedProfile?.options?.strategy_preference || 'unknown',
          });
        }
        
        if (step.toolResults && step.toolResults.length > 0) {
          console.log('✅ Tool results received:', step.toolResults.length);
          step.toolResults.forEach((tr, idx) => {
            console.log(`  [${idx + 1}] Tool: ${tr.toolName}`);
            try {
              // Check if result exists before stringifying
              if (tr.result === undefined || tr.result === null) {
                console.log(`      Result: [${tr.result === undefined ? 'undefined' : 'null'}]`);
              } else {
                const resultStr = JSON.stringify(tr.result);
                const preview = resultStr.length > 300 ? resultStr.substring(0, 300) + '...' : resultStr;
                console.log(`      Result preview:`, preview);
                if (typeof tr.result === 'object' && 'error' in tr.result) {
                  console.error(`      ❌ Tool error:`, tr.result.error);
                }
              }
            } catch (e) {
              console.log(`      Result: [Could not stringify - ${e instanceof Error ? e.message : 'unknown error'}]`);
            }
          });
        }
        
        if (!step.toolCalls || step.toolCalls.length === 0) {
          console.log('💬 No tools called in this step (AI generated text only)');
        }
        
        console.log('📊 ======================================');
      },
    })

    // Log profile updates for client to pick up (simpler approach than stream injection)
    if (profileUpdates) {
      console.log('📡 Server-side profile updates available:', profileUpdates);
      // Store in a simple way that client can access - for now just log
      // In a real app, you might store this in Redis or a database with the userId
    }

    console.log('✅ ========== CONVERSATION API COMPLETE ==========');
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