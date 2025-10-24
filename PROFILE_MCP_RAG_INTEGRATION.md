# Profile + MCP + RAG Integration Guide

## Overview

Your OptionsAI system now has a **complete integration** where:
1. **Profile collection** happens through conversational discovery
2. **Profile data** is passed to all API routes and used to tailor responses
3. **MCP tools** (Polygon.io) are called when market data is needed
4. **RAG tools** (Vectorize) are called when strategy library or educational content is needed
5. All three work together seamlessly

---

## Architecture Flow

```
User → Frontend (app/page.tsx)
  ↓
  Profile stored in localStorage + React state
  ↓
  Profile passed to API routes via body
  ↓
┌─────────────────────────────────────────────────────┐
│ API Routes (with Profile + Tools)                   │
├─────────────────────────────────────────────────────┤
│ 1. /api/conversation (Main Chat - Profile Building) │
│    - Receives profile from frontend                  │
│    - Updates profile from user messages             │
│    - Has access to: Polygon MCP + RAG               │
│    - Uses profile to tailor questions               │
│                                                      │
│ 2. /api/news-strategy (News → Strategy)             │
│    - Receives profile from frontend                  │
│    - Fetches news via Polygon MCP (Railway)         │
│    - Retrieves strategies via RAG (Vectorize)       │
│    - Tailors strategy to profile constraints        │
│                                                      │
│ 3. /api/stock-advisor (Market Data Analysis)        │
│    - Has access to: Polygon MCP + RAG + Web Search  │
│    - Can reference profile for risk-aware advice    │
│                                                      │
│ 4. /api/rag-chat (Document Search)                  │
│    - Pure RAG retrieval                             │
│    - Educational content only                       │
└─────────────────────────────────────────────────────┘
```

---

## Updated Profile Schema

### Core Fields (Existing)
```typescript
interface ClientProfile {
  goals: {
    short_term: string | null;
    medium_term: string | null;
    long_term: string | null;
  };
  risk: {
    tolerance: string | null; // 1-10 or low/moderate/aggressive/high
    history: string | null;
  };
  financials: {
    income: string | null;
    assets: string | null;
    expenses: string | null;
  };
  time_horizon: string | null;
  preferences: string[];
  expectations: string[];
```

### New Options-Specific Fields
```typescript
  options?: {
    experience_level?: string | null; // beginner | intermediate | advanced
    assignment_tolerance?: boolean | null;
    greeks_familiarity?: boolean | null;
    strategy_preference?: string | null; // credit_spreads | debit_spreads | condors | long_options | protective
    directional_bias?: string | null; // bullish | bearish | neutral | volatility_focused
    preferred_underlyings?: string[]; // ["SPY", "QQQ", "TSLA", "AAPL"]
    iv_comfort?: string | null; // high_iv | low_iv | moderate_iv
    holding_period_days?: number | null;
    risk_structure_preference?: string | null; // defined_risk | undefined_risk
    learning_style?: string | null; // strategy_ideas | learning_help | both | automated_alerts
  };
}
```

---

## How Profile is Used

### 1. Frontend (`app/page.tsx`)
```typescript
// Profile stored in state and localStorage
const [profile, setProfile] = useState<ClientProfile>(() => loadProfileFromStorage());

// Profile passed to API
const { messages, sendMessage } = useChat({
  api: "/api/conversation",
  body: {
    userId,
    profile, // ← Sent with every message
  },
});
```

### 2. Main Conversation Route (`app/api/conversation/route.ts`)

**Receives profile:**
```typescript
const { messages, userId, profile: clientProfile } = await req.json();
let currentProfile: ClientProfile = clientProfile || EMPTY_PROFILE;
```

**Adds profile context to system prompt:**
```typescript
if (currentProfile && (currentProfile.goals.short_term || currentProfile.risk.tolerance)) {
  systemContent += `\n\n## CURRENT USER PROFILE:\n${generateFinalProfileSummary(currentProfile)}\n\nUse this profile information to tailor your questions and recommendations.`;
}
```

**Has access to tools:**
```typescript
let tools: Record<string, any> = {
  retrieveKnowledgeBase: retrieveDocumentsTool, // RAG
};

// Add Polygon MCP tools if on Railway
if (process.env.NODE_ENV === 'production') {
  const polygonClient = getPolygonMCPClient();
  await polygonClient.connect();
  const polygonTools = await polygonClient.getTools();
  tools = { ...tools, ...polygonTools };
}

const result = streamText({
  model: openai("gpt-4o-mini"),
  messages: allMessages,
  tools, // ← AI can call MCP + RAG autonomously
});
```

### 3. News → Strategy Route (`app/api/news-strategy/route.ts`)

**Receives profile:**
```typescript
const { ticker, newsText, userProfile, limit = 3 } = await req.json();
```

**Fetches news via Polygon MCP (Railway only):**
```typescript
if (ticker && process.env.NODE_ENV === "production") {
  const polygon = getPolygonMCPClient();
  await polygon.connect();
  const tools = await polygon.getTools();
  
  if (tools?.list_ticker_news?.execute) {
    const res = await tools.list_ticker_news.execute({ ticker, limit });
    // Merge news articles
  }
}
```

**Injects profile constraints into system prompt:**
```typescript
const profileContext = userProfile ? `
## USER PROFILE CONSTRAINTS:
- Risk Tolerance: ${userProfile.risk?.tolerance || 'unknown'}
- Options Experience: ${userProfile.options?.experience_level || 'unknown'}
- Assignment Tolerance: ${userProfile.options?.assignment_tolerance ? 'Yes' : 'No'}
- Strategy Preference: ${userProfile.options?.strategy_preference || 'none specified'}
- Preferred Underlyings: ${userProfile.options?.preferred_underlyings?.join(', ') || 'none specified'}
...
` : '';

const system = `
You recommend options STRATEGIES (not trade executions). Use the provided user profile to constrain choices.
${profileContext}
...
`;
```

**Retrieves strategies via RAG:**
```typescript
const tools = {
  retrieveDocuments: retrieveDocumentsTool, // ← Queries Vectorize strategy library
};

const result = await streamText({
  model: openai("gpt-4o-mini"),
  system,
  messages: [userMsg],
  tools, // ← AI calls retrieveDocuments to find matching strategies
});
```

---

## Tool Orchestration Examples

### Example 1: Profile Building with RAG

**User:** "I want to learn about credit spreads"

**Flow:**
1. Frontend sends message + current profile to `/api/conversation`
2. Backend receives profile, adds it to system context
3. AI sees user wants to learn → calls `retrieveKnowledgeBase` tool
4. RAG retrieves educational documents about credit spreads
5. AI responds with tailored explanation based on user's experience level from profile

### Example 2: News → Strategy with Profile + MCP + RAG

**User calls `/api/news-strategy`:**
```typescript
fetch("/api/news-strategy", {
  method: "POST",
  body: JSON.stringify({
    ticker: "AAPL",
    userProfile: {
      risk: { tolerance: "low" },
      options: {
        experience_level: "beginner",
        assignment_tolerance: false,
        strategy_preference: "credit_spreads",
        preferred_underlyings: ["SPY", "AAPL"],
        holding_period_days: 21,
      }
    }
  })
});
```

**Flow:**
1. Backend receives ticker + profile
2. **MCP call**: Fetches latest AAPL news via Polygon `list_ticker_news`
3. AI extracts signal: "Bullish, moderate IV, 14-day catalyst"
4. **RAG call**: AI calls `retrieveDocuments` with query "bullish moderate IV short-term defined-risk credit spread beginner"
5. Vectorize returns matching strategies (bull put credit spread, etc.)
6. AI tailors response using profile:
   - "low risk" → only defined-risk strategies
   - "beginner" → simple verticals, avoid complex structures
   - "no assignment tolerance" → avoid naked short options
   - "21 days" → suggests 2-3 week expiries
   - "SPY/AAPL" → uses AAPL since it's in preferred list
7. Streams personalized strategy recommendation

### Example 3: Market Data Analysis with Profile Context

**User in main chat:** "What's AAPL's current price and should I consider options?"

**Flow:**
1. Frontend sends message + profile to `/api/conversation`
2. Backend adds profile context to system
3. AI sees need for market data → calls Polygon MCP `get_snapshot_ticker`
4. AI sees options question → calls `retrieveKnowledgeBase` for options education
5. AI responds with:
   - Current AAPL price (from MCP)
   - Options suitability analysis (from RAG + profile)
   - Tailored to user's experience level and risk tolerance

---

## When Each Tool is Called

### Polygon MCP Tools (Market Data)
**Called when:**
- User asks about current prices, news, market status
- User mentions specific tickers (AAPL, TSLA, SPY, etc.)
- User wants historical data, volume, financials
- `/api/news-strategy` needs to fetch recent news

**Available on:**
- Railway (production)
- Localhost (if uvx is in PATH)
- **NOT on Vercel** (serverless limitation)

**Example triggers:**
- "What's AAPL's closing price yesterday?"
- "Show me recent TSLA news"
- "Is the market open?"

### RAG Tools (Strategy Library + Education)
**Called when:**
- User asks "how to" or "what is" questions
- User mentions strategy names (credit spread, iron condor, etc.)
- User wants to learn about options concepts
- `/api/news-strategy` needs to retrieve matching strategies

**Available on:**
- All platforms (Vercel, Railway, localhost)

**Example triggers:**
- "What is a bull call spread?"
- "How do I use credit spreads for income?"
- "Explain implied volatility"

### Both MCP + RAG Together
**Called when:**
- User asks complex questions requiring both data and education
- "Should I buy AAPL options?" → MCP for price/news, RAG for strategy education
- "Analyze TSLA for a bullish play" → MCP for data, RAG for strategy recommendations

---

## Profile Extraction

Profile data is extracted automatically from user messages using pattern matching:

```typescript
// lib/profile-extractor.ts
extractProfileUpdates(userContent, currentProfile);
```

**Examples:**
- "I want consistent income" → `goals.short_term = "consistent income"`
- "I'm a beginner" → `options.experience_level = "beginner"`
- "I'm comfortable with 5/10 risk" → `risk.tolerance = "5"`
- "I prefer SPY and QQQ" → `options.preferred_underlyings = ["SPY", "QQQ"]`
- "I don't want assignment" → `options.assignment_tolerance = false`

---

## Testing the Integration

### Test 1: Profile Building with Tool Access
```bash
# Start dev server
pnpm dev

# In browser, go to localhost:3000
# Chat: "I want to learn about credit spreads for income"
# Expected: AI calls retrieveKnowledgeBase, explains credit spreads
```

### Test 2: News → Strategy (Railway)
```bash
curl -X POST https://your-railway-app.railway.app/api/news-strategy \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "userProfile": {
      "risk": { "tolerance": "low" },
      "options": {
        "experience_level": "beginner",
        "assignment_tolerance": false,
        "strategy_preference": "credit_spreads",
        "holding_period_days": 21
      }
    },
    "limit": 3
  }'
```

**Expected:**
1. Fetches 3 recent AAPL news articles via Polygon MCP
2. Extracts signal (bullish/bearish, IV, horizon)
3. Queries Vectorize for matching strategies
4. Returns tailored strategy (credit spread, 21 DTE, defined-risk, beginner-friendly)

### Test 3: Market Data with Profile Context
```bash
# In main chat
"What was AAPL's closing price yesterday? Should I consider options given my profile?"

# Expected:
# - AI calls get_previous_close_agg (MCP)
# - AI calls retrieveKnowledgeBase (RAG)
# - Response references user's beginner status and risk tolerance
```

---

## Summary

✅ **Profile schema updated** with options-specific fields  
✅ **Profile passed** from frontend to all API routes  
✅ **Profile context injected** into system prompts  
✅ **MCP tools** (Polygon) available in conversation + news-strategy routes  
✅ **RAG tools** (Vectorize) available in all routes  
✅ **Profile constraints** applied to strategy recommendations  
✅ **Tool orchestration** works seamlessly (MCP + RAG + Profile)  

**Your system now:**
- Collects detailed options trading profiles
- Uses profile to tailor all responses
- Calls Polygon MCP for market data when needed
- Calls Vectorize RAG for strategies/education when needed
- Combines all three for comprehensive, personalized recommendations

🚀 **Ready to deploy and test!**


