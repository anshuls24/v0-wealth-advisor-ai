# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build production app
- `npm start` - Start production server
- `npm run lint` - Run ESLint to check for errors

## Code Quality

**IMPORTANT**: Always check for TypeScript and linter errors after writing or modifying any code to ensure there are no errors before considering the task complete.

## Package Manager

This project uses **npm**. Do not use pnpm or yarn.

## Architecture

This is a STOCK-AI Advisor - an AI-powered stock trading advisor application built with TypeScript and Next.js:

### Core Stack

- **Next.js 14.2.16** with App Router
- **AI SDK 5** (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`) with OpenAI GPT-4o
- **RAG System** with Vectorize mock implementation for document retrieval
- **Real-time Profile Extraction** - Trader profile building with localStorage persistence
- **Quick Reply Buttons** - Interactive button responses for multiple-choice questions
- **Voice Recording** - Speech-to-text input capability
- **shadcn/ui** components with custom styling
- **Tailwind CSS** for styling
- **Lucide React** for icons

### Key Directories

- `app/` - Next.js App Router pages and API routes
  - `app/api/conversation/` - Main STOCK-AI advisor chat endpoint with profile extraction
  - `app/api/rag-chat/` - RAG-enabled document search endpoint
  - `app/api/generate-chart/` - Chart generation endpoint
  - `app/api/market-news/` - Market news endpoint with web search
  - `app/page.tsx` - Main STOCK-AI advisor interface
  - `app/dashboard/` - User dashboard
  - `app/market-news/` - Market news page
  - `app/tools/` - Tools page (RAG chat access)
- `components/` - React components
  - `components/agent/` - Agent configuration and tools
    - `prompt.ts` - StockAI system prompt (trading advisor)
    - `rag-prompt.ts` - RAG document search assistant prompt
    - `tools/` - AI SDK tools for agent capabilities
      - `retrieve-documents.ts` - RAG document retrieval tool
      - `index.ts` - Tool exports
  - `components/ui/` - shadcn/ui components
    - `quick-replies.tsx` - Interactive button system for chat
  - `components/ai-elements/` - AI-specific UI components
    - `sources.tsx` - Source citation display
  - `components/rag-chat.tsx` - RAG chat interface component
  - `components/chart-generator.tsx` - Chart generation component
  - `components/profile-completion-tracker.tsx` - Profile progress UI
  - `components/voice-recorder.tsx` - Voice input component
- `lib/` - Utility libraries
  - `lib/retrieval/vectorize.ts` - VectorizeService for RAG document retrieval
  - `lib/profile-schema.ts` - ClientProfile type and validation
  - `lib/profile-extractor.ts` - Profile data extraction logic
  - `lib/real-time-profile-tracker.ts` - Profile progress tracking
  - `lib/utils.ts` - Utility functions
- `types/` - TypeScript type definitions

### AI Integration

#### Core AI SDK Documentation (MUST READ)

**CRITICAL**: Always read these AI SDK docs before implementing any AI functionality:

1. **useChat Hook**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
   - Main hook for chat functionality
   - Handles streaming, message management, and status
   - **CRITICAL**: `sendMessage()` ONLY accepts `{ text: "message" }` format
   - **NEVER** use `sendMessage("string")` - this does NOT work

2. **streamText**: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
   - Backend streaming API for generating text
   - Used in all API routes (`/api/conversation`, `/api/rag-chat`)
   - Returns streaming responses via `toUIMessageStreamResponse()`

3. **AI SDK Tools**: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
   - How tools are called by language models
   - Tool execution flow and lifecycle
   - Multi-step tool calling with `stopWhen` and `stepCountIs()`

4. **Data Streaming**: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
   - Streaming custom data parts (sources, citations, etc.)
   - Tool results and structured data

5. **Manual Agent Loop**: https://ai-sdk.dev/cookbook/node/manual-agent-loop
   - Advanced agentic patterns
   - Multi-step reasoning and tool orchestration

#### AI SDK Configuration

- **Model**: OpenAI GPT-4o (`openai("gpt-4o")`)
- **Streaming**: All responses use `streamText()` with `.toUIMessageStreamResponse()`
- **Message Conversion**: UI messages converted via `convertToModelMessages()`
- **Agent Behavior**: Multi-step tool execution via `stopWhen: stepCountIs(10)`
- **Temperature**: 0.7 for advisor, 0.1 for RAG (factual responses)

#### Available Agents

##### 1. STOCK-AI Advisor Agent (`/api/conversation`)

**Purpose**: Personal stock trading advisor with profile building

**System Prompt**: `components/agent/prompt.ts`
- StockAI - experienced stock advisor and trading strategist
- Conducts comprehensive discovery conversation
- Builds trader profile (goals, risk, experience, style, tools)
- Provides tailored stock insights and strategy recommendations

**Features**:
- Real-time profile extraction from user responses
- Progress tracking with completion percentage
- Profile summary generation
- localStorage persistence (`stockai_profile`, `stockai_user_id`)
- Profile confirmation workflow
- Quick reply buttons for multiple-choice questions

**Profile Schema** (`lib/profile-schema.ts`):
```typescript
interface ClientProfile {
  // Trading Goals
  shortTermGoals?: string[]
  longTermGoals?: string[]
  tradingFocus?: string
  successDefinition?: string
  benchmarks?: string[]
  
  // Risk & Capital
  tradingCapital?: number
  riskTolerance?: number
  lossReaction?: string
  positionSizing?: string
  maxDrawdown?: number
  
  // Experience & Knowledge
  experienceLevel?: string
  technicalAnalysisKnowledge?: string
  indicators?: string[]
  derivativesExperience?: string[]
  learningPreference?: string
  
  // Strategy & Style
  tradingStyle?: string[]
  preferredSectors?: string[]
  marketCapPreference?: string
  holdingPeriod?: string
  analysisApproach?: string
  
  // Stock Selection & Tools
  watchlist?: string[]
  trackedIndices?: string[]
  preferredIndicators?: string[]
  desiredSetups?: string[]
  currentTools?: string[]
  
  // Expectations & Concerns
  concerns?: string[]
  updateFrequency?: string
  reportingPreference?: string[]
  previousAdvisorExperience?: string
  successCriteria?: string
}
```

##### 2. RAG Document Search Assistant (`/api/rag-chat`)

**Purpose**: Search financial knowledge base documents (NOT a trading advisor)

**System Prompt**: `components/agent/rag-prompt.ts`
- Document Search Assistant (NOT STOCK-AI advisor)
- Searches knowledge base using `retrieveKnowledgeBase` tool
- Provides information based ONLY on retrieved documents
- Clear identity separation from main advisor

**Tool**: `retrieveKnowledgeBase` (`components/agent/tools/retrieve-documents.ts`)
```typescript
export const retrieveDocumentsTool = tool({
  description: "Search financial document collection",
  inputSchema: z.object({
    query: z.string().describe("Search query with key terms")
  }),
  execute: async ({ query }) => {
    const vectorizeService = new VectorizeService();
    const documents = await vectorizeService.retrieveDocuments(query, 5, 0.6);
    
    return {
      context: vectorizeService.formatDocumentsForContext(documents),
      sources: documents.map(doc => ({
        sourceType: "url" as const,
        id: `source-${Date.now()}`,
        url: doc.metadata?.url || "#",
        title: doc.metadata?.title || "Document"
      })),
      chatSources: vectorizeService.convertDocumentsToChatSources(documents)
    };
  }
});
```

**Features**:
- Agent-based architecture with `stopWhen: stepCountIs(10)`
- Tool-based document retrieval
- Source citation display
- Streaming responses with tool invocations
- Indigo theme (vs blue for main advisor)

#### Multi-Step Agent Pattern (CRITICAL)

**MUST READ**: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#multi-step-calls

For agents to autonomously execute tools, you MUST use `stopWhen: stepCountIs(N)`:

```typescript
// ✅ CORRECT - Agent can make multiple tool calls
const result = streamText({
  model: openai("gpt-4o"),
  messages: modelMessages,
  tools: { retrieveKnowledgeBase },
  stopWhen: stepCountIs(10), // ⚡ THIS MAKES IT AN AGENT!
});

// ❌ WRONG - Only single tool call, no autonomous behavior
const result = streamText({
  model: openai("gpt-4o"),
  messages: modelMessages,
  tools: { retrieveKnowledgeBase },
  // Missing stopWhen - NOT an agent!
});
```

**Why this matters**:
- Without `stopWhen`, the model stops after first tool call
- With `stopWhen`, the model can make multiple tool calls and reason between them
- Enables autonomous agent behavior

#### Tool Implementation Pattern

**Location**: All tools in `components/agent/tools/`

**Structure**:
```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: 'Clear description for model to understand when to use this',
  inputSchema: z.object({
    param: z.string().describe('What this parameter is for')
  }),
  execute: async ({ param }) => {
    console.log(`🔧 Tool executing: ${param}`);
    try {
      // Tool logic here
      const result = await performAction(param);
      console.log(`✅ Tool completed`);
      return {
        data: result,
        // For RAG tools, include sources:
        sources: [{ sourceType: "url", id: "...", url: "...", title: "..." }]
      };
    } catch (error) {
      console.error(`💥 Tool error:`, error);
      throw error;
    }
  }
});
```

**Best Practices**:
- Use `tool()` helper from `ai` package
- Define `inputSchema` with Zod (NOT `parameters`)
- Add `.describe()` to all schema fields for better model understanding
- Include comprehensive console logging
- Return structured data (context, sources, etc.)
- Handle errors gracefully

### Quick Reply Button System

**Purpose**: Interactive button responses for multiple-choice questions

**Documentation**: `QUICK_REPLY_BUTTONS.md`

#### AI Format in Responses

The AI includes buttons using this format:

```
What are your main goals when trading stocks?

[BUTTONS: Grow account quickly | Consistent monthly income | Build wealth | Long-term investing]
```

#### Frontend Parsing

```typescript
// Parse buttons from AI response
function parseQuickReplies(content: string): { text: string; buttons: string[] | null } {
  const buttonPattern = /\[BUTTONS:\s*([^\]]+)\]/gi;
  const match = content.match(buttonPattern);
  
  if (match && match.length > 0) {
    const firstMatch = match[0];
    const buttonsText = firstMatch.replace(/\[BUTTONS:\s*/i, '').replace(/\]/g, '');
    const buttons = buttonsText.split('|').map(b => b.trim()).filter(b => b.length > 0);
    const cleanText = content.replace(buttonPattern, '').trim();
    return { text: cleanText, buttons };
  }
  
  return { text: content, buttons: null };
}
```

#### Button Component

`components/ui/quick-replies.tsx`:
```typescript
interface QuickRepliesProps {
  options: { text: string; value?: string }[]
  onSelect: (value: string) => void
  disabled?: boolean
}
```

**Features**:
- Hover effects (blue theme, arrow icon)
- Disabled state during AI response
- Only shows on last assistant message
- Flexible option format

#### Button Guidelines for AI Prompt

Configured in `components/agent/prompt.ts`:

```typescript
4. **Quick Reply Buttons** – When asking multiple-choice questions, provide 2-5 button options:
   
   [BUTTONS: Option 1 | Option 2 | Option 3 | Option 4]
   
   Example: [BUTTONS: Grow account quickly | Consistent monthly income | Build wealth | Financial independence]

**Button Guidelines:**
- Use buttons for questions with 2-5 clear options
- Keep button text short (2-5 words max)
- Separate options with pipe character: |
- Use for: goals, risk levels, experience, styles, yes/no, preferences
```

### Profile Management System

#### Real-time Profile Extraction

**Pattern**: Extract profile data from conversation in `onFinish` callback

```typescript
const { messages, sendMessage, status } = useChat({
  api: "/api/conversation",
  onFinish: async (message) => {
    // Extract profile updates from latest user message
    if (messages.length > 0) {
      const latestUserMessage = messages[messages.length - 1];
      if (latestUserMessage?.role === 'user') {
        const userContent = latestUserMessage.content || '';
        
        // Client-side extraction
        const updates = extractProfileUpdates(userContent);
        if (Object.keys(updates).length > 0) {
          setProfile(prev => {
            const updated = applyProfileUpdates(prev, updates);
            saveProfileToStorage(updated); // localStorage persistence
            return updated;
          });
        }
      }
    }
  }
});
```

**Key Functions**:
- `extractProfileUpdates()` - Parse user text for profile fields (`lib/profile-extractor.ts`)
- `applyProfileUpdates()` - Merge updates into profile
- `isProfileComplete()` - Check if all required fields present
- `getProfileCompletionPercentage()` - Calculate progress percentage
- `generateEditableProfileSummary()` - Create markdown summary

**Storage**:
- localStorage keys: `stockai_profile`, `stockai_user_id`
- Persists across sessions
- Can migrate to database (Supabase ready)

#### Profile Completion Tracker

`components/profile-completion-tracker.tsx`:
- Visual progress bar
- Field-by-field completion status
- Editable profile summary
- Inline field editing

### Chat Architecture

#### Frontend Pattern (useChat Hook)

**Documentation**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat

```typescript
import { useChat } from "@ai-sdk/react"

const { messages, sendMessage, status, error } = useChat({
  id: "advisor", // Unique ID for conversation
  api: "/api/conversation", // API endpoint
  body: { userId }, // Additional data sent with each request
  onFinish: async (message) => {
    // Handle completed messages (profile extraction, etc.)
  }
});

// Sending messages - CRITICAL FORMAT
const handleSend = () => {
  sendMessage({ text: inputValue }); // ✅ CORRECT
  // sendMessage(inputValue); // ❌ WRONG - Does NOT work!
};
```

**CRITICAL RULES**:
- ✅ `sendMessage({ text: "message" })` - ONLY this format works
- ❌ `sendMessage("string")` - Does NOT work, causes runtime errors
- Messages have `parts` array, not simple `content` field
- Status values: "ready", "streaming", "submitted"
- Always check `status` before enabling/disabling UI

#### Backend Pattern (streamText)

**Documentation**: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

```typescript
import { openai } from "@ai-sdk/openai"
import { streamText, convertToModelMessages, stepCountIs } from "ai"

export async function POST(request: NextRequest) {
  const { messages, userId } = await request.json();
  
  // Convert UI messages to model format
  const modelMessages = convertToModelMessages(messages);
  
  // Stream response with tools
  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_INSTRUCTIONS,
    messages: modelMessages,
    temperature: 0.7,
    stopWhen: stepCountIs(10), // Multi-step agent behavior
    tools: {
      myTool: myToolDefinition
    }
  });
  
  // Return UI-compatible stream
  return result.toUIMessageStreamResponse();
}
```

**Key Points**:
- Always convert messages: `convertToModelMessages(messages)`
- Use `.toUIMessageStreamResponse()` for frontend compatibility
- Include `stopWhen: stepCountIs(N)` for agentic behavior
- Handle errors with try-catch and proper error responses

#### Message Structure

Messages from `useChat` have this structure:

```typescript
interface UIMessage {
  id: string
  role: "user" | "assistant" | "system"
  content?: string // May be undefined
  parts?: Array<{
    type: "text" | "tool-call" | "tool-result" | "source-url"
    text?: string
    toolName?: string
    toolCallId?: string
    result?: any
    input?: any
  }>
}
```

**Rendering Messages**:
```typescript
// Extract text content
const content = message.content ?? (
  message.parts
    ?.filter((part: any) => part.type === 'text')
    ?.map((part: any) => part.text)
    ?.join('') || ''
);

// Extract tool calls
const toolCalls = message.parts?.filter(
  (part: any) => part.type === 'tool-result' || part.type === 'tool-invocation'
);

// Extract sources
const sources = message.parts
  ?.filter((part: any) => part.type === 'source-url')
  ?.map((part: any) => ({ url: part.url, title: part.title }));
```

### Message Deduplication

**Issue**: `useChat` can create duplicate messages during streaming

**Solution**: Deduplicate by ID before rendering

```typescript
// Deduplicate messages by ID
Array.from(new Map(messages.map(m => [m.id, m])).values())
  .map((message, index, deduplicatedMessages) => {
    // Render message...
  })
```

**Documentation**: `MESSAGE_DEDUPLICATION_FIX.md`

### RAG Implementation

#### Architecture

**Backend**: `app/api/rag-chat/route.ts`
- Agent-based with `stopWhen: stepCountIs(10)`
- Uses `retrieveKnowledgeBase` tool
- Streams responses with `toUIMessageStreamResponse()`

**Service**: `lib/retrieval/vectorize.ts`
- `VectorizeService` class for document retrieval
- Mock implementation with financial documents
- Methods:
  - `retrieveDocuments(query, limit, threshold)` - Get relevant docs
  - `formatDocumentsForContext(documents)` - Format for LLM
  - `convertDocumentsToChatSources(documents)` - Format for UI

**Tool**: `components/agent/tools/retrieve-documents.ts`
- Uses AI SDK `tool()` helper
- `inputSchema` with Zod validation
- Returns: `{ context, sources, chatSources }`

**Frontend**: `components/rag-chat.tsx`
- Uses `useChat` hook with `/api/rag-chat` endpoint
- Extracts sources from tool results
- Displays document citations
- Loading indicators during retrieval

#### Source Extraction Pattern

```typescript
// In component
const [documentSources, setDocumentSources] = useState<any[]>([]);

useEffect(() => {
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant' && lastMessage.parts) {
      // Extract from tool results
      const toolParts = lastMessage.parts.filter(
        (part: any) => part.type === 'tool-result'
      );
      
      for (const toolPart of toolParts) {
        if (toolPart.result?.sources) {
          setDocumentSources(toolPart.result.sources);
        }
      }
    }
  }
}, [messages]);
```

**Documentation**: `RAG_REFACTOR_PROTOCOL.md`, `RAG_SCHEMA_FIX.md`

### Environment Variables

Required in `.env.local`:

```bash
# OpenAI API (required)
OPENAI_API_KEY=your_openai_api_key

# Optional services
VECTORIZE_ACCESS_TOKEN=your_vectorize_token
VECTORIZE_ORG_ID=your_org_id
VECTORIZE_PIPELINE_ID=your_pipeline_id
TAVILY_API_KEY=your_tavily_key # For web search in market news
```

### UI Components

#### shadcn/ui Components

**Installation**: `npx shadcn@latest add [component-name]`

**Configured with**:
- Import aliases: `@/components`, `@/lib/utils`
- Tailwind CSS with custom styling
- Lucide React icons
- Custom color schemes (blue for advisor, indigo for RAG)

**Used Components**:
- Button, Input, Card, Badge, Avatar, Tabs, Progress, Select, Label, Collapsible

#### AI Elements

**Not currently using Vercel AI Elements** - Custom chat UI built with shadcn/ui

If adding AI Elements:
```bash
npx ai-elements@latest
```

Then use components from `components/ai-elements/`:
- Message, PromptInput, Tool, Sources, Reasoning

**Documentation**: https://ai-sdk.dev/elements

### Voice Recording

`components/voice-recorder.tsx`:
- Browser speech recognition API
- Real-time transcription
- Sends transcribed text to chat
- Fallback for unsupported browsers

### Chart Generation

`components/chart-generator.tsx`:
- Generates financial charts via `/api/generate-chart`
- Various chart types (line, bar, candlestick, etc.)
- Configurable timeframes and metrics

### Market News

`app/api/market-news/route.ts`:
- Web search integration (Tavily API)
- Real-time market news and analysis
- Streaming responses
- Categorized news display

## Critical Rules and Best Practices

### DO's ✅

1. **Always read AI SDK docs first** before implementing any AI functionality
2. **Use `sendMessage({ text: "message" })`** - Only this format works
3. **Use `stopWhen: stepCountIs(N)`** for agentic behavior with tools
4. **Use `tool()` helper with `inputSchema`** (NOT `parameters`)
5. **Convert messages with `convertToModelMessages()`** in API routes
6. **Return `result.toUIMessageStreamResponse()`** from API routes
7. **Deduplicate messages by ID** before rendering
8. **Parse message.parts array** for content, tools, sources
9. **Add console logging** in tools for debugging
10. **Handle errors gracefully** with try-catch blocks
11. **Check `status`** before enabling/disabling UI elements
12. **Use localStorage** for profile persistence (or migrate to DB)
13. **Follow existing patterns** in `components/agent/` and `components/agent/tools/`

### DON'Ts ❌

1. **NEVER use `sendMessage("string")`** - Does NOT work!
2. **NEVER use `parameters` in tool definitions** - Use `inputSchema`
3. **NEVER forget `stopWhen: stepCountIs(N)`** for agents with tools
4. **NEVER access `message.content` directly** - Use `message.parts`
5. **NEVER skip error handling** in tool execute functions
6. **NEVER create tools without logging** - Makes debugging impossible
7. **NEVER mix agent identities** - RAG ≠ STOCK-AI advisor
8. **NEVER skip message deduplication** - Causes duplicate displays
9. **NEVER use plain JSON Schema** - Use Zod with AI SDK 5
10. **NEVER forget to convert messages** in API routes

### Common Pitfalls

#### 1. SendMessage Format Error
```typescript
// ❌ WRONG
sendMessage(inputValue)
sendMessage("hello")

// ✅ CORRECT
sendMessage({ text: inputValue })
sendMessage({ text: "hello" })
```

#### 2. Tool Not Executing (Missing stopWhen)
```typescript
// ❌ WRONG - Tool won't execute autonomously
const result = streamText({
  model: openai("gpt-4o"),
  messages: modelMessages,
  tools: { myTool }
});

// ✅ CORRECT - Agent can execute tools
const result = streamText({
  model: openai("gpt-4o"),
  messages: modelMessages,
  tools: { myTool },
  stopWhen: stepCountIs(10) // ⚡ Essential!
});
```

#### 3. Tool Schema Error (Using parameters)
```typescript
// ❌ WRONG - Causes "Invalid schema" error
export const myTool = tool({
  description: "...",
  parameters: z.object({ query: z.string() }), // Wrong!
  execute: async ({ query }) => { ... }
});

// ✅ CORRECT - Use inputSchema
export const myTool = tool({
  description: "...",
  inputSchema: z.object({ query: z.string() }), // Correct!
  execute: async ({ query }) => { ... }
});
```

#### 4. Message Content Access Error
```typescript
// ❌ WRONG - content might be undefined
const text = message.content;

// ✅ CORRECT - Handle parts array structure
const text = message.content ?? (
  message.parts
    ?.filter((part: any) => part.type === 'text')
    ?.map((part: any) => part.text)
    ?.join('') || ''
);
```

## Key Documentation Files

- `QUICK_REPLY_BUTTONS.md` - Interactive button system
- `MESSAGE_DEDUPLICATION_FIX.md` - Fixing duplicate messages
- `RAG_REFACTOR_PROTOCOL.md` - RAG implementation details
- `RAG_SCHEMA_FIX.md` - Tool schema fixes
- `AGENT_DIFFERENCES.md` - RAG vs Advisor distinction
- `REBRAND_TO_STOCK_AI.md` - Branding guidelines

## Essential AI SDK Links

### Core Documentation
- **AI SDK Overview**: https://ai-sdk.dev/docs
- **Getting Started**: https://ai-sdk.dev/docs/getting-started
- **AI SDK Core**: https://ai-sdk.dev/docs/ai-sdk-core
- **AI SDK UI**: https://ai-sdk.dev/docs/ai-sdk-ui
- **AI SDK RSC**: https://ai-sdk.dev/docs/ai-sdk-rsc

### useChat Hook (CRITICAL)
- **useChat Reference**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- **useChat Guide**: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
- **Streaming Data**: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data

### streamText (Backend)
- **streamText Reference**: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- **Text Generation Guide**: https://ai-sdk.dev/docs/ai-sdk-core/generating-text
- **Streaming Responses**: https://ai-sdk.dev/docs/ai-sdk-core/streaming

### Tools & Agents
- **Tools Documentation**: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- **Tool Calling Guide**: https://ai-sdk.dev/docs/foundations/tools
- **Multi-step Calls**: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#multi-step-calls
- **Manual Agent Loop**: https://ai-sdk.dev/cookbook/node/manual-agent-loop
- **Agent Example**: https://ai-sdk.dev/examples/next-app/tools/call-tool

### Message Handling
- **Message Types**: https://ai-sdk.dev/docs/reference/ai-sdk-core/message
- **Convert Messages**: https://ai-sdk.dev/docs/reference/ai-sdk-core/convert-to-model-messages
- **UI Messages**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/ui-message

### Providers
- **OpenAI Provider**: https://ai-sdk.dev/providers/ai-sdk-providers/openai
- **Provider Registry**: https://ai-sdk.dev/providers
- **Custom Providers**: https://ai-sdk.dev/providers/community-providers

### Advanced Features
- **Structured Outputs**: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- **Image Generation**: https://ai-sdk.dev/docs/ai-sdk-core/generating-images
- **Embeddings**: https://ai-sdk.dev/docs/ai-sdk-core/embeddings
- **Error Handling**: https://ai-sdk.dev/docs/ai-sdk-core/error-handling

### AI Elements (If Added)
- **AI Elements Home**: https://ai-sdk.dev/elements
- **Components**: https://ai-sdk.dev/elements/components
- **Reasoning Component**: https://ai-sdk.dev/elements/components/reasoning
- **Message Component**: https://ai-sdk.dev/elements/components/message
- **Tool Component**: https://ai-sdk.dev/elements/components/tool

### Cookbook & Examples
- **Cookbook**: https://ai-sdk.dev/cookbook
- **Examples**: https://ai-sdk.dev/examples
- **Next.js Examples**: https://ai-sdk.dev/examples/next-app

## Project-Specific Patterns

### Adding a New Tool

1. Create tool file in `components/agent/tools/my-tool.ts`:
```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: 'What the tool does and when to use it',
  inputSchema: z.object({
    param: z.string().describe('Parameter description for model')
  }),
  execute: async ({ param }) => {
    console.log(`🔧 MyTool executing: ${param}`);
    try {
      const result = await doSomething(param);
      console.log(`✅ MyTool completed`);
      return { data: result };
    } catch (error) {
      console.error(`💥 MyTool error:`, error);
      throw error;
    }
  }
});
```

2. Export from `components/agent/tools/index.ts`:
```typescript
export { myTool } from './my-tool';
```

3. Add to API route:
```typescript
import { myTool } from '@/components/agent/tools';

const result = streamText({
  model: openai("gpt-4o"),
  // ...
  tools: {
    myTool,
    // other tools...
  },
  stopWhen: stepCountIs(10)
});
```

### Adding a New Agent

1. Create system prompt in `components/agent/my-agent-prompt.ts`:
```typescript
const MY_AGENT_SYSTEM_INSTRUCTIONS = `You are...`;
export { MY_AGENT_SYSTEM_INSTRUCTIONS };
```

2. Create API route in `app/api/my-agent/route.ts`:
```typescript
import { openai } from "@ai-sdk/openai"
import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { MY_AGENT_SYSTEM_INSTRUCTIONS } from "@/components/agent/my-agent-prompt"
import { myTool } from "@/components/agent/tools"
import { NextRequest } from "next/server"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const modelMessages = convertToModelMessages(messages);
    
    const result = streamText({
      model: openai("gpt-4o"),
      system: MY_AGENT_SYSTEM_INSTRUCTIONS,
      messages: modelMessages,
      temperature: 0.7,
      stopWhen: stepCountIs(10),
      tools: {
        myTool
      }
    });
    
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("My Agent error:", error);
    return new Response(
      JSON.stringify({ error: "Error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

3. Create UI component using `useChat`:
```typescript
const { messages, sendMessage, status } = useChat({
  api: "/api/my-agent"
});
```

### Profile Field Extraction

When adding new profile fields:

1. Update `lib/profile-schema.ts`:
```typescript
export interface ClientProfile {
  // ... existing fields
  newField?: string
}
```

2. Update `lib/profile-extractor.ts`:
```typescript
export function extractProfileUpdates(message: string): Partial<ClientProfile> {
  const updates: Partial<ClientProfile> = {}
  
  // Add extraction logic
  if (/pattern/.test(message.toLowerCase())) {
    updates.newField = extractedValue
  }
  
  return updates
}
```

3. Update completion calculation in `lib/profile-schema.ts`:
```typescript
export function getProfileCompletionPercentage(profile: ClientProfile): number {
  const requiredFields = [
    // ... existing
    profile.newField ? 1 : 0
  ]
  // ...
}
```

## Testing Checklist

Before considering a task complete:

- [ ] No TypeScript errors (`npm run build` succeeds)
- [ ] No linter errors (`npm run lint` passes)
- [ ] AI functionality tested (messages send/receive correctly)
- [ ] Tool execution confirmed (check console logs)
- [ ] Profile extraction works (localStorage updates)
- [ ] UI renders correctly (no layout issues)
- [ ] Error handling works (graceful failures)
- [ ] Button interactions work (if using quick replies)
- [ ] Source citations display (if RAG-related)
- [ ] Message deduplication working (no duplicates)

## Debugging Tips

### Enable Verbose Logging

Add to API routes:
```typescript
console.log('🔥 API: Request received');
console.log('🔥 API: Messages:', messages?.length);
console.log('🔥 API: ModelMessages:', modelMessages);
```

### Check Tool Execution

In tool `execute` function:
```typescript
console.log(`🔧 Tool called with:`, { param1, param2 });
console.log(`✅ Tool result:`, result);
```

### Monitor useChat State

In component:
```typescript
useEffect(() => {
  console.log('📊 Messages:', messages.length);
  console.log('📊 Status:', status);
  console.log('📊 Latest message:', messages[messages.length - 1]);
}, [messages, status]);
```

### Check Message Structure

```typescript
console.log('Message parts:', message.parts);
console.log('Tool calls:', message.parts?.filter(p => p.type === 'tool-result'));
```

## Summary

This STOCK-AI Advisor is a sophisticated agentic AI application with:

- **Two distinct agents**: STOCK-AI trading advisor + RAG document search
- **Real-time profile building**: Extracts trader info from conversation
- **Interactive UI**: Quick reply buttons for better UX
- **RAG system**: Document retrieval with source citations
- **Streaming architecture**: All responses stream via AI SDK
- **Tool-based agents**: Autonomous multi-step reasoning
- **localStorage persistence**: Profile data saved locally
- **Modern stack**: Next.js 14 + AI SDK 5 + TypeScript

**Always refer to AI SDK documentation links above before implementing any AI functionality!**

