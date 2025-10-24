# 🎯 Profile Injection Guide

## Overview

This document explains how **user profile information is injected into the RAG and MCP tools** throughout the application, ensuring personalized, context-aware recommendations.

---

## 🔄 **Profile Flow Architecture**

### **1. Profile Collection (Frontend)**
**File:** `app/page.tsx`

```typescript
// Profile state managed in React
const [profile, setProfile] = useState<ClientProfile>(() => {
  return loadProfileFromStorage() // Load from localStorage
})

// Profile is sent with EVERY message to the backend
const { messages, sendMessage } = useChat({
  api: "/api/conversation",
  body: () => ({
    userId,
    profile, // ✅ Current profile sent to backend
  }),
})
```

**Key Points:**
- Profile is stored in `localStorage` for persistence
- Profile is extracted from user messages in real-time
- Profile is sent as part of the request body on every chat message
- Profile ref (`profileRef`) ensures latest state is always used

---

### **2. Profile Reception (Backend)**
**File:** `app/api/conversation/route.ts`

```typescript
export async function POST(req: Request) {
  // ✅ Profile received from frontend
  const { messages, userId, profile: clientProfile } = await req.json()
  
  let currentProfile: ClientProfile = clientProfile || EMPTY_PROFILE;
  
  // Extract additional profile updates from latest message
  const updates = extractProfileUpdates(userContent, currentProfile);
  const updatedProfile = applyProfileUpdates(currentProfile, updates);
  
  // Profile is now available for tool injection
  console.log('👤 Profile received:', {
    riskTolerance: updatedProfile?.risk?.tolerance,
    experience: updatedProfile?.options?.experience_level,
    completion: getProfileCompletionPercentage(updatedProfile) + '%',
  });
}
```

**Key Points:**
- Profile is received from frontend request body
- Profile is updated with new information from user messages
- Updated profile is used for tool creation

---

### **3. Profile Injection into RAG Tool**
**File:** `components/agent/tools/retrieve-documents.ts`

#### **A. Tool Creation with Profile**

```typescript
export function createRetrieveDocumentsTool(userProfile?: ClientProfile | null) {
  return tool({
    description: "Search knowledge base with automatic profile filtering...",
    execute: async ({ query }) => {
      // ✅ Profile is available in closure
      console.log('👤 RAG Tool: User Profile Received:', {
        hasProfile: !!userProfile,
        riskTolerance: userProfile?.risk?.tolerance,
        experience: userProfile?.options?.experience_level,
      });
      
      // Enhance query with profile context
      let enhancedQuery = query;
      if (userProfile) {
        const profileContext = [
          `risk_tolerance:${userProfile.risk?.tolerance}`,
          `experience:${userProfile.options?.experience_level}`,
          `strategy:${userProfile.options?.strategy_preference}`,
        ];
        enhancedQuery = `${query} [${profileContext.join(' ')}]`;
      }
      
      // Retrieve documents with enhanced query
      const documents = await vectorizeService.retrieveDocuments(enhancedQuery, 5);
      
      // Append profile context to results
      let context = formatDocumentsForContext(documents);
      if (userProfile) {
        context += `\n\n--- USER PROFILE CONTEXT ---\n`;
        context += `Risk Tolerance: ${userProfile.risk?.tolerance}\n`;
        context += `Experience: ${userProfile.options?.experience_level}\n`;
        context += `\nTailor your response to match this user's profile.`;
      }
      
      return { context, sources, profileContext };
    }
  });
}
```

#### **B. Tool Instantiation in Conversation Route**

**File:** `app/api/conversation/route.ts`

```typescript
// ✅ Create profile-aware RAG tool with user's profile
const profileAwareRAGTool = createRetrieveDocumentsTool(updatedProfile);

let tools: Record<string, any> = {
  retrieveKnowledgeBase: profileAwareRAGTool, // ✅ Profile injected
};

// Add Polygon MCP tools (they receive profile via system prompt)
if (process.env.NODE_ENV === 'production') {
  const polygonTools = await polygonClient.getTools();
  tools = { ...tools, ...polygonTools };
}

// Pass tools to AI
const result = streamText({
  model: openai("gpt-4o-mini"),
  messages: allMessages,
  tools, // ✅ All tools have profile context
  onStepFinish: (step) => {
    // Log when tools are called
    console.log('🔧 Tools called:', step.toolCalls.map(tc => tc.toolName));
    console.log('👤 Profile context:', {
      riskTolerance: updatedProfile?.risk?.tolerance,
      experience: updatedProfile?.options?.experience_level,
    });
  },
});
```

---

### **4. Profile Injection into System Prompt (for MCP Tools)**
**File:** `app/api/conversation/route.ts`

```typescript
// Build system prompt with profile context
let systemContent = SYSTEM_INSTRUCTIONS;

// Add current profile context
if (currentProfile && currentProfile.risk.tolerance) {
  systemContent += `\n\n## CURRENT USER PROFILE:\n${generateFinalProfileSummary(currentProfile)}\n\nProfile Completion: ${profilePercentage}%\n\nUse this profile information to tailor your questions and recommendations.`;
}

// If profile is complete, enable recommendation mode
if (profileComplete) {
  systemContent += `\n\n## RECOMMENDATION MODE ENABLED
  
The user's profile is COMPLETE. You can now:
- Recommend specific strategies (use retrieveKnowledgeBase)
- Analyze tickers using Polygon MCP tools
- Provide personalized trade ideas

Always reference their profile:
- Risk tolerance: ${updatedProfile.risk.tolerance}
- Experience: ${updatedProfile.options?.experience_level}
- Strategy preference: ${updatedProfile.options?.strategy_preference}
- Preferred underlyings: ${updatedProfile.options?.preferred_underlyings?.join(', ')}

Use tools proactively and combine them for comprehensive recommendations.`;
}
```

**Key Points:**
- MCP tools don't directly receive profile (they're external processes)
- Profile is injected into system prompt so AI can contextualize MCP tool usage
- AI agent uses profile constraints when interpreting MCP tool results

---

### **5. Profile Injection into News-Strategy Route**
**File:** `app/api/news-strategy/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const { ticker, newsText, userProfile } = await req.json();
  
  console.log('📰 News-Strategy: Profile received:', {
    hasProfile: !!userProfile,
    riskTolerance: userProfile?.risk?.tolerance,
    experience: userProfile?.options?.experience_level,
  });
  
  // Build profile-aware system prompt
  const profileContext = userProfile ? `
## USER PROFILE CONSTRAINTS:
- Risk Tolerance: ${userProfile.risk?.tolerance}
- Options Experience: ${userProfile.options?.experience_level}
- Strategy Preference: ${userProfile.options?.strategy_preference}
- Preferred Underlyings: ${userProfile.options?.preferred_underlyings?.join(', ')}
...
` : '';
  
  // Create profile-aware RAG tool
  const profileAwareRAGTool = createRetrieveDocumentsTool(userProfile);
  
  const tools = {
    retrieveDocuments: profileAwareRAGTool, // ✅ Profile injected
  };
  
  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system: `You recommend strategies. ${profileContext}...`,
    messages: [userMsg],
    tools, // ✅ Profile-aware tools
  });
}
```

---

## 📊 **Profile Data Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (app/page.tsx)                  │
│                                                                   │
│  1. User types message: "I want income from options"            │
│  2. Profile extracted: { goals: { short_term: "income" } }      │
│  3. Profile saved to localStorage                                │
│  4. Profile sent with message to backend                         │
│                                                                   │
│     body: () => ({ userId, profile })  ✅                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (app/api/conversation/route.ts)         │
│                                                                   │
│  5. Receive profile from request body                            │
│     const { profile: clientProfile } = await req.json()          │
│                                                                   │
│  6. Extract additional updates from message                      │
│     updatedProfile = applyProfileUpdates(clientProfile, updates) │
│                                                                   │
│  7. Inject profile into system prompt                            │
│     systemContent += `USER PROFILE: ${profile}...`               │
│                                                                   │
│  8. Create profile-aware RAG tool                                │
│     const ragTool = createRetrieveDocumentsTool(updatedProfile)  │
│                                                                   │
│  9. Add Polygon MCP tools (profile in system prompt)             │
│     tools = { retrieveKnowledgeBase: ragTool, ...polygonTools }  │
│                                                                   │
│ 10. Pass tools to AI agent                                       │
│     streamText({ model, messages, tools })  ✅                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI AGENT (OpenAI GPT-4o-mini)                 │
│                                                                   │
│ 11. AI reads system prompt with profile context                  │
│ 12. AI decides to call retrieveKnowledgeBase tool                │
│ 13. Tool executes with profile-enhanced query                    │
│ 14. Tool returns results + profile context                       │
│ 15. AI synthesizes response tailored to user's profile           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 **How Profile Affects Tool Behavior**

### **RAG Tool (retrieveKnowledgeBase)**

| Profile Field | How It's Used |
|--------------|---------------|
| `risk.tolerance` | Appended to query: `"bull put spread [risk_tolerance:conservative]"` |
| `options.experience_level` | Appended to query: `"iron condor [experience:beginner]"` |
| `options.strategy_preference` | Appended to query: `"strategy:credit_spreads"` |
| `options.preferred_underlyings` | Mentioned in result context: "Preferred: SPY, QQQ" |

**Example Enhanced Query:**
```
Original: "bull put spread strategy"
Enhanced: "bull put spread strategy [risk_tolerance:moderate experience:intermediate strategy:credit_spreads]"
```

**Example Result Context:**
```
--- RETRIEVED DOCUMENTS ---
[Document 1: Bull Put Spread Overview...]
[Document 2: Credit Spread Strategies...]

--- USER PROFILE CONTEXT ---
Risk Tolerance: moderate
Options Experience: intermediate
Preferred Strategy: credit_spreads
Preferred Underlyings: SPY, QQQ

IMPORTANT: Tailor your response to match this user's profile. Only recommend strategies appropriate for their risk level and experience.
```

---

### **MCP Tools (Polygon Market Data)**

MCP tools are **external processes** and cannot directly receive profile data. Instead:

1. **Profile is injected into system prompt**
   - AI agent reads profile constraints before calling MCP tools
   
2. **AI agent interprets MCP results through profile lens**
   - Example: AI gets SPY price from MCP, then filters strategy recommendations based on user's risk tolerance

3. **Sequential orchestration ensures profile alignment**
   - Step 1: AI calls MCP to get market data
   - Step 2: AI calls RAG with profile-enhanced query
   - Step 3: AI synthesizes response matching user's profile

---

## 🧪 **Testing Profile Injection**

### **1. Check Profile is Sent to Backend**

Open browser console and look for:
```
🔧 Conversation: Initializing tools with user profile...
👤 Conversation: Profile being injected: {
  hasProfile: true,
  riskTolerance: 'moderate',
  experience: 'intermediate',
  strategyPref: 'credit_spreads',
  completion: '75%'
}
```

### **2. Check RAG Tool Receives Profile**

Look for:
```
🔍 RAG Tool: Executing document retrieval for: "bull put spread"
👤 RAG Tool: User Profile Received: {
  hasProfile: true,
  riskTolerance: 'moderate',
  experience: 'intermediate',
  strategyPref: 'credit_spreads',
  preferredUnderlyings: ['SPY', 'QQQ']
}
🎯 RAG Tool: Enhanced query with profile: "bull put spread [risk_tolerance:moderate experience:intermediate strategy:credit_spreads]"
✅ RAG Tool: Retrieved 5 documents with profile context
```

### **3. Check Tools are Called**

Look for:
```
🔧 Conversation: Tools called in this step: ['retrieveKnowledgeBase']
👤 Conversation: Profile context for these tools: {
  riskTolerance: 'moderate',
  experience: 'intermediate',
  strategyPref: 'credit_spreads'
}
✅ Conversation: Tool results received: 1
```

---

## 🎯 **Profile Storage Strategy**

### **Temporary Storage (Current Implementation)**

- **Frontend:** Profile stored in `localStorage` (persists across sessions)
- **Backend:** Profile received with each request, not stored permanently
- **Tool Execution:** Profile passed via closure to tool functions

**Advantages:**
- ✅ No database required
- ✅ Privacy-friendly (no server-side storage)
- ✅ Works immediately without authentication
- ✅ Profile available until user clears browser data

**Limitations:**
- ❌ Profile lost if user switches devices
- ❌ No cross-device sync
- ❌ No historical profile tracking

### **Future: Persistent Storage (Optional)**

For production apps with user accounts:

```typescript
// Store profile in database (e.g., Supabase, MongoDB)
await db.profiles.upsert({
  userId,
  profile: updatedProfile,
  updatedAt: new Date(),
});

// Retrieve profile on backend
const storedProfile = await db.profiles.findOne({ userId });
```

---

## 🚀 **Summary**

### **✅ Profile is Injected Into:**

1. **System Prompt** (for AI context and MCP tool interpretation)
2. **RAG Tool** (via closure, enhances queries and results)
3. **News-Strategy Tool** (via closure, filters strategy recommendations)
4. **Tool Execution Logs** (for debugging and verification)

### **✅ Profile is NOT Stored:**

- ❌ Not stored in backend database (temporary per-request only)
- ❌ Not stored in MCP server (external process)
- ✅ Only stored in frontend `localStorage` for persistence

### **✅ Profile Lifecycle:**

1. **Collection:** Extracted from user messages in real-time
2. **Storage:** Saved to `localStorage` on frontend
3. **Transmission:** Sent with every message to backend
4. **Injection:** Passed to tools via closure and system prompt
5. **Usage:** Tools use profile to enhance queries and filter results
6. **Expiration:** Persists until user clears browser data or manually resets

---

## 📝 **Key Files**

| File | Purpose |
|------|---------|
| `app/page.tsx` | Profile state management and transmission |
| `app/api/conversation/route.ts` | Profile reception and tool injection |
| `components/agent/tools/retrieve-documents.ts` | Profile-aware RAG tool |
| `lib/profile-schema.ts` | Profile type definitions |
| `lib/profile-extractor.ts` | Profile extraction logic |

---

**Last Updated:** October 24, 2025

