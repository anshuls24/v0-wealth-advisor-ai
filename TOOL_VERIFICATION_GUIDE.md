# Tool Verification Guide - Is Your Agent Actually Using MCP & RAG?

## ✅ Quick Answer: YES, But Here's How to Verify

Your agent **IS configured** to use both MCP and RAG tools. Here's how to verify they're actually being called:

---

## 🔍 How to Check if Tools Are Being Called

### **Method 1: Check Terminal Logs (Best Way)**

When your agent calls tools, you'll see logs in your terminal:

#### **RAG Tool Calls:**
```bash
🔍 RAG Tool: Executing document retrieval for: "bull put credit spread strategy"
✅ RAG Tool: Retrieved 5 documents successfully
```

#### **Polygon MCP Tool Calls (Railway/Production):**
```bash
✅ Conversation: Added 53 Polygon tools
🔧 Tool Called: get_snapshot_ticker
📥 Input: {"ticker":"AAPL"}
✅ Success (178ms)
📤 Output: {"ticker":"AAPL","c":187.45,...}
```

---

## 🧪 Test Cases to Verify Tool Usage

### **Test 1: RAG Tool (Works Everywhere)**

**What to do:**
1. Start your app: `pnpm dev`
2. Open browser console (F12)
3. In chat, type: **"What is a bull put credit spread?"**

**What you should see in terminal:**
```bash
🔍 RAG Tool: Executing document retrieval for: "bull put credit spread"
✅ RAG Tool: Retrieved 5 documents successfully
```

**What you should see in chat:**
```
OptionsAI: "A bull put credit spread is a defined-risk options strategy where you 
simultaneously sell a higher-strike put and buy a lower-strike put. [detailed explanation 
from retrieved documents]..."
```

**If you DON'T see terminal logs:**
- ❌ Tool is NOT being called
- ❌ AI is using general knowledge instead
- ❌ Need to update prompt (which I just did!)

---

### **Test 2: Polygon MCP Tools (Railway Only)**

**What to do:**
1. Deploy to Railway
2. In chat, type: **"What was SPY's closing price yesterday?"**

**What you should see in Railway logs:**
```bash
✅ Conversation: Added 53 Polygon tools
🔧 Tool Called: get_previous_close_agg
📥 Input: {"ticker":"SPY"}
✅ Success (245ms)
📤 Output: {"ticker":"SPY","c":567.89,"o":563.42,...}
```

**What you should see in chat:**
```
OptionsAI: "SPY closed at $567.89 yesterday, up 0.8% from the prior close of $563.42. 
Volume was 45.2M shares..."
```

**If you DON'T see logs:**
- ❌ MCP not connected (check Railway env vars)
- ❌ Tool not being called (AI using general knowledge)

---

### **Test 3: Combined Tools (MCP + RAG)**

**What to do:**
1. On Railway, type: **"Should I trade options on AAPL?"**

**What you should see in Railway logs:**
```bash
🔧 Tool Called: get_snapshot_ticker
📥 Input: {"ticker":"AAPL"}
✅ Success (178ms)

🔧 Tool Called: list_ticker_news
📥 Input: {"ticker":"AAPL","limit":3}
✅ Success (312ms)

🔍 RAG Tool: Executing document retrieval for: "beginner options strategies"
✅ RAG Tool: Retrieved 5 documents successfully
```

**What you should see in chat:**
```
OptionsAI: "Let me analyze AAPL for you...

📊 Current Data:
AAPL is trading at $187.45 (+2.1% today)
Volume: 52.3M (above average)

📰 Recent News:
1. Strong iPhone sales in China
2. Services revenue beats estimates
3. Analyst upgrades from Morgan Stanley

💡 Recommendation:
Given your beginner experience and moderate risk tolerance, I recommend a bull put 
credit spread [detailed strategy from RAG]..."
```

---

## 🚨 Common Issues & Fixes

### **Issue 1: No Tool Logs in Terminal**

**Problem:** AI is answering without calling tools

**Fix:** I just updated your prompt to explicitly instruct the AI to use tools. The new section says:

```
## 🔧 AVAILABLE TOOLS (Use These Proactively!)

### 1. retrieveKnowledgeBase (RAG Tool)
When to use:
- User asks "what is" or "how does" questions
- User wants to learn about strategies
- You need strategy details

### 2. Polygon MCP Tools
When to use:
- User asks about prices, news, market status
- User mentions a ticker
- You need real-time data

IMPORTANT: Always call tools when you need data or educational content!
```

**Test again after this update.**

---

### **Issue 2: MCP Tools Not Available**

**Problem:** Logs show "Polygon MCP unavailable"

**Causes:**
1. Running on localhost (MCP only works on Railway)
2. Missing `NODE_ENV=production` in Railway
3. Missing `POLYGON_API_KEY` in Railway

**Fix:**
```bash
# In Railway dashboard, set:
NODE_ENV=production
POLYGON_API_KEY=your_key_here
```

---

### **Issue 3: RAG Returns "No documents found"**

**Problem:** RAG tool is called but returns empty

**Cause:** Your Vectorize pipeline doesn't have strategy documents indexed yet

**Fix:** You need to upload strategy documents to Vectorize. See `PROFILE_MCP_RAG_INTEGRATION.md` for the JSON format.

---

## 📊 Current Configuration Status

### **✅ What's Already Set Up:**

1. **Tools are configured** in `app/api/conversation/route.ts`:
```typescript
let tools: Record<string, any> = {
  retrieveKnowledgeBase: retrieveDocumentsTool, // ✅ RAG
};

// Add Polygon MCP if on Railway
if (process.env.NODE_ENV === 'production') {
  const polygonClient = getPolygonMCPClient();
  await polygonClient.connect();
  const polygonTools = await polygonClient.getTools();
  tools = { ...tools, ...polygonTools }; // ✅ MCP
}

const result = streamText({
  model: openai("gpt-4o-mini"),
  messages: allMessages,
  tools, // ✅ Tools passed to AI
});
```

2. **System prompt now instructs AI to use tools** (just updated):
```typescript
## 🔧 AVAILABLE TOOLS (Use These Proactively!)
- retrieveKnowledgeBase for education
- Polygon MCP for market data
- Combine tools for comprehensive answers
IMPORTANT: Always call tools when you need data!
```

3. **Recommendation mode explicitly mentions tools**:
```typescript
if (profileComplete) {
  systemContent += `
  RECOMMENDATION MODE ENABLED
  - Use retrieveKnowledgeBase for strategy details
  - Use Polygon MCP tools for market data
  - Combine both for comprehensive recommendations
  `;
}
```

---

## 🎯 Step-by-Step Verification

### **Localhost Test (RAG Only):**

1. **Start app:**
```bash
pnpm dev
```

2. **Open terminal side-by-side with browser**

3. **In chat, ask:**
```
"What is a credit spread?"
```

4. **Watch terminal for:**
```bash
🔍 RAG Tool: Executing document retrieval for: "credit spread"
✅ RAG Tool: Retrieved X documents successfully
```

5. **If you see logs:** ✅ RAG is working!
6. **If you DON'T see logs:** ❌ AI not calling tool (check prompt)

---

### **Railway Test (MCP + RAG):**

1. **Deploy to Railway**

2. **Check Railway logs (real-time)**

3. **In chat, ask:**
```
"What was AAPL's closing price yesterday?"
```

4. **Watch Railway logs for:**
```bash
✅ Conversation: Added 53 Polygon tools
🔧 Tool Called: get_previous_close_agg
📥 Input: {"ticker":"AAPL"}
✅ Success (245ms)
```

5. **If you see logs:** ✅ MCP is working!
6. **If you DON'T see logs:** ❌ Check env vars

---

## 🔧 Debugging Checklist

**If tools aren't being called:**

- [ ] Updated prompt includes tool instructions (just did this)
- [ ] Restart dev server after prompt update
- [ ] Hard refresh browser (Cmd+Shift+R)
- [ ] Check terminal for tool logs
- [ ] For MCP: Running on Railway with NODE_ENV=production
- [ ] For MCP: POLYGON_API_KEY set in Railway
- [ ] For RAG: Documents indexed in Vectorize (optional for now)

---

## 📈 Expected Behavior After Update

### **Before (Without Tool Instructions):**
```
You: "What is a credit spread?"
AI: "A credit spread is an options strategy where... [general knowledge]"
Terminal: [no logs]
```

### **After (With Tool Instructions):**
```
You: "What is a credit spread?"
AI: [calls retrieveKnowledgeBase]
Terminal: 🔍 RAG Tool: Executing document retrieval...
AI: "Based on the strategy library, a credit spread is... [from RAG documents]"
```

---

## ✅ Summary

**Your agent IS configured to use tools:**
- ✅ Tools passed to `streamText()`
- ✅ System prompt now explicitly instructs AI to use them
- ✅ Recommendation mode references tools
- ✅ Logging in place to verify calls

**To verify:**
1. Test RAG on localhost with "What is a credit spread?"
2. Check terminal for `🔍 RAG Tool:` logs
3. Test MCP on Railway with "What was SPY's close yesterday?"
4. Check Railway logs for `🔧 Tool Called:` logs

**If no logs appear:**
- Restart dev server
- Hard refresh browser
- Check Railway env vars (NODE_ENV, POLYGON_API_KEY)

The tools ARE there and configured - the prompt update I just made ensures the AI will actually USE them! 🚀


