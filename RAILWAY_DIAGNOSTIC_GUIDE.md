# Railway Deployment Diagnostic Guide

This guide helps you verify that MCP (Polygon.io) and RAG (Vectorize) are working correctly on Railway.

## 🔍 How to Check Railway Logs

1. Go to your Railway dashboard: https://railway.app/
2. Click on your project (`v0-wealth-advisor-ai`)
3. Click on your service/deployment
4. Click on the **"Deployments"** tab
5. Click on the most recent deployment
6. Click **"View Logs"** button
7. Watch logs in real-time as you interact with your app

---

## ✅ What to Look For in Logs

### 1. **Environment & API Keys Status** (At Request Start)

When you send a message, look for:

```
🚀 ========== CONVERSATION API START ==========
🌍 Environment: production
🔑 API Keys Status: {
  openai: '✅ Set',
  polygon: '✅ Set',
  vectorize_token: '✅ Set',
  vectorize_org: '✅ Set',
  vectorize_pipeline: '✅ Set'
}
```

**If you see `❌ Missing` for any key:**
- Go to Railway dashboard → Your Service → **Variables** tab
- Add the missing environment variable
- Redeploy

---

### 2. **Profile Injection Verification**

```
🔧 Conversation: Initializing tools with user profile...
👤 Conversation: Profile being injected: {
  hasProfile: true,
  riskTolerance: 'moderate',
  experience: 'beginner',
  strategyPref: 'credit_spreads',
  completion: '45%'
}
```

**This confirms:**
- ✅ User profile is being sent from frontend
- ✅ Profile is available to RAG and MCP tools

---

### 3. **MCP (Polygon) Connection**

Look for these logs in sequence:

```
🏭 Production mode detected - attempting to load Polygon MCP tools...
🔍 Polygon MCP: Environment: production, Using uvx path: uvx
🔌 Connecting to Polygon MCP server...
🚀 Connecting to Polygon MCP server via STDIO...
✅ Polygon MCP client connected successfully
🔧 Retrieving Polygon MCP tools...
✅ Retrieved 15 Polygon tools
📋 Available Polygon tools: get_snapshot_ticker, get_previous_close_agg, list_ticker_news, ...
📋 Conversation: Total tools available: 16 (RAG + MCP)
```

**If MCP connection fails:**

```
❌ Conversation: Polygon MCP connection failed: Error: ...
❌ Error details: Failed to spawn uvx process
⚠️ Conversation: Falling back to profile-aware RAG only
```

**Possible fixes:**
- Check `railway.toml` has `nixPkgs = ["python311", "uv"]`
- Check `POLYGON_API_KEY` is set in Railway variables
- Try redeploying (Railway may need to rebuild with Nixpacks)

---

### 4. **RAG (Vectorize) Connection**

When a tool is called, look for:

```
🔍 Vectorize: Retrieving documents for: "bull put credit spread beginner" (numResults: 5)
🔍 Vectorize Config: {
  orgId: 'a39d3aa7-...',
  pipelineId: 'your-pipeline-id',
  hasToken: true,
  tokenPrefix: 'eyJhbGciOiJSUzI1NiIsInR5cCI6...'
}
🔍 Vectorize URL: https://api.vectorize.io/v1/org/a39d3aa7-.../pipelines/.../retrieval
✅ Vectorize: Retrieved 5 documents from API
```

**If Vectorize fails but falls back to mock:**

```
❌ Vectorize API error: 401 Unauthorized
❌ Error body: {"error":"Invalid token"}
⚠️ Falling back to mock documents
✅ Vectorize (Mock): Retrieved 5 documents
```

**Fixes:**
1. Regenerate `VECTORIZE_PIPELINE_ACCESS_TOKEN` from Vectorize dashboard
2. Update token in Railway variables
3. Make sure you're on a paid Vectorize plan (free tier may be limited)
4. Check org ID and pipeline ID are correct

---

### 5. **Tool Execution Logs**

When AI calls tools, you'll see:

```
📊 ========== STEP FINISHED ==========
🔧 Tools called in this step: 2
  [1] Tool: get_snapshot_ticker
      Args: {"ticker":"AAPL"}
  [2] Tool: retrieveKnowledgeBase
      Args: {"query":"bullish moderate-IV credit spread beginner"}
👤 Profile context for these tools: {
  riskTolerance: 'moderate',
  experience: 'beginner',
  strategyPref: 'credit_spreads'
}
✅ Tool results received: 2
  [1] Tool: get_snapshot_ticker
      Result preview: {"ticker":"AAPL","price":187.45,"change":3.15,...}
  [2] Tool: retrieveKnowledgeBase
      Result preview: {"context":"Credit spreads are options strategies...","sources":[...]}
📊 ======================================
```

**This confirms:**
- ✅ AI is autonomously calling tools
- ✅ Multiple tools being orchestrated
- ✅ Profile context is available
- ✅ Both MCP and RAG are working

---

### 6. **If NO Tools Are Called**

```
💬 No tools called in this step (AI generated text only)
```

**This means:**
- The AI decided tools weren't needed for this query
- OR the AI doesn't recognize the query requires tool use

**To test, ask explicit questions:**
- "What's SPY's current price?" (should call MCP)
- "Explain credit spreads" (should call RAG)
- "Should I trade AAPL options?" (should call both MCP then RAG)

---

## 🧪 Test Queries to Verify Functionality

### Test 1: MCP Only (Market Data)
**Query:** "What's the current price of SPY?"

**Expected logs:**
```
🔧 Tools called in this step: 1
  [1] Tool: get_snapshot_ticker
      Args: {"ticker":"SPY"}
✅ Tool results received: 1
  [1] Tool: get_snapshot_ticker
      Result preview: {"ticker":"SPY","price":567.89,...}
```

---

### Test 2: RAG Only (Strategy Knowledge)
**Query:** "What is a bull put credit spread?"

**Expected logs:**
```
🔧 Tools called in this step: 1
  [1] Tool: retrieveKnowledgeBase
      Args: {"query":"bull put credit spread strategy"}
🔍 Vectorize: Retrieving documents for: "bull put credit spread strategy"
✅ Vectorize: Retrieved 5 documents from API
✅ Tool results received: 1
  [1] Tool: retrieveKnowledgeBase
      Result preview: {"context":"Credit spreads are options strategies where you sell...
```

---

### Test 3: MCP + RAG (Comprehensive)
**Query:** "Should I trade options on AAPL? I'm a beginner."

**Expected logs:**
```
🔧 Tools called in this step: 2-3
  [1] Tool: get_snapshot_ticker
      Args: {"ticker":"AAPL"}
  [2] Tool: list_ticker_news
      Args: {"ticker":"AAPL","limit":5}
✅ Tool results received: 2

[Next step...]
🔧 Tools called in this step: 1
  [1] Tool: retrieveKnowledgeBase
      Args: {"query":"bullish moderate-IV beginner credit spread AAPL"}
```

**This demonstrates sequential orchestration:**
1. First: AI gets market data (MCP)
2. Then: AI analyzes data and builds specific query
3. Finally: AI retrieves strategies (RAG) based on market conditions + profile

---

## ⚠️ Common Issues & Solutions

### Issue 1: All API Keys Show ❌ Missing

**Cause:** Environment variables not set in Railway

**Fix:**
1. Railway dashboard → Your Service → **Variables** tab
2. Add each variable:
   - `OPENAI_API_KEY`
   - `POLYGON_API_KEY`
   - `VECTORIZE_PIPELINE_ACCESS_TOKEN`
   - `VECTORIZE_ORGANIZATION_ID`
   - `VECTORIZE_PIPELINE_ID`
   - `NODE_ENV=production`
3. Click "Deploy" to restart with new variables

---

### Issue 2: MCP Connection Fails (uvx not found)

**Logs:**
```
❌ Conversation: Polygon MCP connection failed
❌ Error details: spawn uvx ENOENT
```

**Fix:**
1. Delete your Railway service completely
2. Recreate it from GitHub repo
3. Make sure `railway.toml` has:
   ```toml
   [build.nixpacksPlan.phases.setup]
   nixPkgs = ["python311", "uv"]
   ```
4. Railway will rebuild with proper Python environment

---

### Issue 3: Vectorize Returns 401/402 Errors

**Logs:**
```
❌ Vectorize API error: 401 Unauthorized
❌ Error body: {"error":"Invalid or expired token"}
⚠️ Falling back to mock documents
```

**Fix:**
1. Go to https://vectorize.io dashboard
2. Navigate to your pipeline
3. Generate a new **Retrieval Access Token**
4. Copy the new token
5. Update `VECTORIZE_PIPELINE_ACCESS_TOKEN` in Railway
6. Redeploy

---

### Issue 4: Tools Are Available But Never Called

**Logs:**
```
📋 Conversation: Total tools available: 16 (RAG + MCP)
[... later ...]
💬 No tools called in this step (AI generated text only)
```

**Cause:** AI prompt may not be instructing tool use strongly enough

**Fix:**
- Ask more explicit questions (see Test Queries above)
- Check `components/agent/prompt.ts` has tool usage instructions
- Make sure system prompt is being injected correctly

---

## 📊 Success Checklist

After deploying to Railway, verify:

- [ ] ✅ All 5 API keys show `✅ Set` in logs
- [ ] ✅ MCP connection succeeds: `✅ Polygon MCP client connected`
- [ ] ✅ 16 total tools available (1 RAG + 15 MCP)
- [ ] ✅ Vectorize retrieves real documents (not mock fallback)
- [ ] ✅ Profile is injected: `hasProfile: true` with actual values
- [ ] ✅ Tools are called when appropriate queries are asked
- [ ] ✅ Tool results are received and include data
- [ ] ✅ No errors in final response to user

---

## 🆘 Still Having Issues?

If you see errors that aren't covered here:

1. **Copy the full error logs** from Railway
2. **Note which test query** you used
3. **Check all environment variables** are set correctly
4. **Verify your Vectorize and Polygon accounts** are active and have valid API keys
5. Try **redeploying** (sometimes Railway caching causes issues)
6. If MCP fails, try **deleting and recreating** the Railway service

---

## 📝 Next Steps After Verification

Once all checks pass:
1. Test with real user profile building (go through full conversation)
2. Verify profile completion triggers (75% and 100%)
3. Test with various tickers (SPY, QQQ, AAPL, TSLA, etc.)
4. Test edge cases (market closed, invalid tickers, etc.)
5. Monitor Railway logs during production use

**Your orchestration framework should now be fully operational! 🚀**

