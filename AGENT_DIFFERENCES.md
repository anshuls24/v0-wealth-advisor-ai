# Agent Differences - RAG vs Advisor

## The Problem You Reported

Your **RAG Document Search Assistant** was acting like your **STOCK-AI Advisor** - greeting users with:
> "Hello! Welcome to STOCK-AI. I'm here to provide you with personalized stock trading advice. To get started, I'll need to gather some information to complete your trading profile..."

This was **WRONG** - the two agents have completely different roles!

---

## The Two Agents: Side by Side

| Feature | **RAG Document Search Assistant** | **STOCK-AI Advisor** |
|---------|----------------------------------|----------------------|
| **Location** | `/tools` page (AI-RAG button) | Main `/` page |
| **API Endpoint** | `/api/rag-chat` | `/api/conversation` |
| **System Prompt** | `components/agent/rag-prompt.ts` | Built into conversation route |
| **Primary Role** | Search & retrieve document info | Provide personalized advice |
| **Identity** | "Document Search Assistant" | "STOCK-AI Trading Advisor" |
| **UI Icon** | 📄 FileText (indigo) | 🤖 Bot (blue) |
| **UI Color** | Indigo/Purple theme | Blue theme |

---

## 1. RAG Document Search Assistant

### **Purpose**
Search and retrieve information from financial documents. Acts as a **research tool**.

### **Greeting**
```
"Hello! I'm your Document Search Assistant. I can help you find information 
from our financial document library. What would you like to know about?"
```

### **What It DOES**
✅ Search documents using the `retrieve_documents` tool
✅ Answer questions based on retrieved documents
✅ Cite sources and reference documents
✅ Explain financial concepts found in documents
✅ Show document sources in sidebar

### **What It DOES NOT Do**
❌ Gather personal information
❌ Create financial profiles
❌ Ask about financial goals
❌ Provide personalized advice
❌ Act as a planning assistant

### **Example Interactions**

**Good Questions:**
- "What is a Roth IRA?"
- "Explain dollar cost averaging"
- "What are the benefits of diversification?"
- "Tell me about 401k contribution limits"

**Response Style:**
```
[Searches documents using retrieve_documents tool]

Based on the retrieved documents, a Roth IRA is a type of retirement 
account where you contribute after-tax dollars...

Sources:
- Retirement Planning Guide (Doc #3)
- Tax-Advantaged Accounts Overview (Doc #7)
```

### **UI Design**
- **Title**: "Document Search Assistant"
- **Subtitle**: "Search financial documents • Not a financial advisor"
- **Icon**: 📄 FileText (indigo)
- **Header**: Gradient indigo/blue
- **Placeholder**: "Search financial documents... (e.g., 'What is a 401k?')"
- **Right Sidebar**: Shows document sources with relevance scores

---

## 2. STOCK-AI Advisor

### **Purpose**
Provide personalized financial advice and build user financial profiles.

### **Greeting**
```
"Hello! Welcome to STOCK-AI. I'm here to provide you with personalized 
financial advice. To get started, I'll need to gather some information to 
complete your financial profile. You can track your profile completion 
progress in the Profile Summary on the left.

To begin, could you share some of your financial goals?"
```

### **What It DOES**
✅ Gather personal financial information
✅ Create and update user profiles
✅ Track profile completion
✅ Provide personalized advice
✅ Discuss financial goals and planning
✅ Ask clarifying questions about user's situation

### **What It DOES NOT Do**
❌ Search document libraries
❌ Use RAG tools
❌ Show document sources

### **Example Interactions**

**Good Questions:**
- "I want to save for retirement"
- "Should I buy a house or rent?"
- "How much should I save each month?"
- "I'm 35 with $50k saved, what should I do?"

**Response Style:**
```
That's great that you're thinking about retirement! To provide you with 
the best advice, I'd like to know a bit more:

1. What's your current age?
2. When do you hope to retire?
3. Do you have any existing retirement accounts?

Based on this information, I can help you create a retirement savings plan 
tailored to your goals.
```

### **UI Design**
- **Title**: "STOCK-AI Advisor"
- **Icon**: 🤖 Bot (blue)
- **Left Sidebar**: Profile completion tracker
- **Placeholder**: "Ask a financial question..."
- **Focus**: Conversation and advice

---

## Technical Implementation

### RAG Assistant (`/api/rag-chat`)

```typescript
import { RAG_SYSTEM_INSTRUCTIONS } from "@/components/agent/rag-prompt"

const result = streamText({
  model: openai("gpt-4o"),
  system: RAG_SYSTEM_INSTRUCTIONS,  // ✅ Document search role
  messages: modelMessages,
  tools: {
    retrieve_documents: retrieveDocuments,  // ✅ Has RAG tool
  },
})
```

**Key Features:**
- Uses specialized RAG system instructions
- Has `retrieve_documents` tool
- Temperature: 0.1 (more factual)
- Returns document sources

### Advisor (`/api/conversation`)

```typescript
const result = streamText({
  model: openai("gpt-4o"),
  system: ADVISOR_SYSTEM_INSTRUCTIONS,  // ✅ Personal advisor role
  messages: modelMessages,
  tools: {
    // Different tools for profile management
  },
})
```

**Key Features:**
- Uses advisor system instructions
- Has profile management tools
- Conversational style
- Tracks user information

---

## The Fix Applied

### 1. **Strengthened RAG Identity** ✅

Added clear identity markers to `components/agent/rag-prompt.ts`:

```typescript
You are a specialized **Document Search Assistant** for financial information. 
You are NOT a financial advisor. Your ONLY job is to help users find and 
understand information from financial documents.

## IDENTITY & GREETING
When users greet you (hello, hi, etc.), respond briefly with:
"Hello! I'm your Document Search Assistant. I can help you find information 
from our financial document library. What would you like to know about?"

DO NOT:
- Introduce yourself as a financial advisor
- Offer to create profiles or gather personal information
- Discuss financial planning or goals
- Act like a personal assistant
```

### 2. **Added Critical Reminders** ✅

```typescript
## CRITICAL IDENTITY REMINDERS

❌ **YOU ARE NOT:**
- A financial advisor
- A wealth planner
- A personal assistant
- A profile gathering system
- STOCK-AI advisor

✅ **YOU ARE:**
- A document search assistant
- A financial information retriever
- A research helper for documents
```

### 3. **Updated UI for Clear Distinction** ✅

**Before:**
```tsx
<CardTitle>
  <Bot /> AI-RAG Assistant
</CardTitle>
```

**After:**
```tsx
<CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
  <CardTitle>
    <FileText className="text-indigo-600" />
    <div>
      <div>Document Search Assistant</div>
      <div className="text-xs">Search financial documents • Not a financial advisor</div>
    </div>
  </CardTitle>
</CardHeader>
```

### 4. **Updated Placeholder & Empty State** ✅

**Before:**
```
"Ask a question about your documents..."
```

**After:**
```
"Search financial documents... (e.g., 'What is a 401k?')"

Empty state shows:
- FileText icon (instead of Bot)
- "Search Financial Documents"
- Example queries
```

---

## Testing the Difference

### Test RAG Assistant (Tools Page)

1. Navigate to `/tools` 
2. Click "AI-RAG" button
3. Should see: **"Document Search Assistant"** with indigo theme
4. Type: "hello"
5. **Expected Response:**
   ```
   Hello! I'm your Document Search Assistant. I can help you find 
   information from our financial document library. What would you 
   like to know about?
   ```

6. Ask: "What is a 401k?"
7. **Expected Behavior:**
   - Shows "Retrieving documents..." indicator
   - Searches documents using tool
   - Provides answer based on retrieved docs
   - Shows document sources in right sidebar

### Test STOCK-AI Advisor (Main Page)

1. Navigate to `/` (home page)
2. Should see main chat interface
3. Type: "hello"
4. **Expected Response:**
   ```
   Hello! Welcome to STOCK-AI. I'm here to provide you with 
   personalized financial advice. To get started, I'll need to 
   gather some information to complete your financial profile...
   ```

5. Ask: "I want to save for retirement"
6. **Expected Behavior:**
   - Asks about your age, goals, situation
   - Provides personalized advice
   - Updates profile tracker
   - No document retrieval

---

## Quick Reference

### When to Use RAG Assistant
- "What is [financial concept]?"
- "Explain [financial term]"
- "Tell me about [investment strategy]"
- Research and learning questions

### When to Use STOCK-AI Advisor
- "Help me plan for retirement"
- "Should I [personal financial decision]?"
- "I'm [age] with [situation], what should I do?"
- Personal advice and planning

---

## Summary

The agents are now **clearly differentiated**:

1. **RAG Assistant** = Document search tool (indigo theme, FileText icon)
2. **STOCK-AI Advisor** = Personal stock trading advisor (blue theme, Bot icon)

The fix ensures the RAG assistant will NEVER:
- ❌ Introduce itself as STOCK-AI
- ❌ Offer to gather profile information
- ❌ Act as a financial advisor
- ❌ Discuss personal financial planning

Instead, it will:
- ✅ Search documents
- ✅ Provide factual information
- ✅ Cite sources
- ✅ Stay in its document search role

**Test it now by refreshing and typing "hello" in the RAG chat!** 🚀

