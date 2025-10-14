# 🚀 Deploy Stock-AI Advisor to Railway

Railway is the **best platform** for deploying your Stock-AI Advisor with Polygon MCP integration because it supports persistent processes and Python subprocesses.

---

## 📋 Prerequisites

- GitHub repository (you already have this)
- Railway account (free to sign up)
- Environment variables ready:
  - `OPENAI_API_KEY`
  - `POLYGON_API_KEY`

---

## 🚂 Step-by-Step Deployment

### **1. Create Railway Account**
Go to: https://railway.app
- Click "Sign up with GitHub"
- Authorize Railway to access your repositories

### **2. Create New Project**
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose: `anshuls24/v0-wealth-advisor-ai`
4. Railway will auto-detect Next.js

### **3. Add Environment Variables**
In your Railway project dashboard:
1. Go to **"Variables"** tab
2. Add these variables:
   ```
   OPENAI_API_KEY=sk-...
   POLYGON_API_KEY=your_polygon_key
   NODE_ENV=production
   ```

### **4. Configure Python/uvx Support**

Create a `railway.toml` file:

```toml
[build]
builder = "NIXPACKS"

[build.nixpacksPlan.phases.setup]
nixPkgs = ["python311", "python311Packages.pip"]

[build.nixpacksPlan.phases.install]
cmds = ["pip install uv"]

[deploy]
startCommand = "pnpm start"
```

### **5. Update Your Code for Production**

Update `lib/mcp/client/polygon-client.ts`:

```typescript
constructor(config: PolygonMCPConfig) {
  this.apiKey = config.apiKey;
  this.transport = config.transport || "stdio";
  
  // Use 'uvx' in production (Railway has it in PATH)
  // Use full path in local development
  this.pythonPath = config.pythonPath || 
    (process.env.NODE_ENV === 'production' ? 'uvx' : '/Users/anshul/.local/bin/uvx');
  
  console.log(`🔍 Polygon MCP: Using uvx path: ${this.pythonPath}`);
}
```

### **6. Deploy!**

1. **Commit changes**:
   ```bash
   git add railway.toml lib/mcp/client/polygon-client.ts
   git commit -m "feat: Add Railway deployment configuration"
   git push origin main
   ```

2. **Railway auto-deploys** (watch the logs in Railway dashboard)

3. **Wait ~3-5 minutes** for build + deploy

4. **Get your URL**: Railway provides a custom URL like:
   ```
   https://stock-ai-advisor-production.up.railway.app
   ```

---

## ✅ Verify Deployment

### **Test Stock MCP Server:**
1. Go to: `https://your-app.railway.app/stock-advisor`
2. Ask: "What was AAPL's closing price yesterday?"
3. Check Railway logs for:
   ```
   ✅ Polygon MCP client connected successfully
   ✅ Retrieved 53 Polygon tools
   ```

---

## 🔧 Troubleshooting

### **Issue: `spawn uvx ENOENT`**
**Solution**: Add `uv` installation to railway.toml:
```toml
[build.nixpacksPlan.phases.install]
cmds = ["pip install uv"]
```

### **Issue: Build fails**
**Solution**: Check Railway build logs and ensure:
- All environment variables are set
- `pnpm-lock.yaml` is committed
- Node.js version is 18+ (set in `package.json`):
  ```json
  "engines": {
    "node": ">=18.0.0"
  }
  ```

### **Issue: High latency**
**Solution**: Railway has multiple regions. Change region in:
**Settings → General → Region** → Select closest to you

---

## 💰 Pricing

Railway pricing is usage-based:

| Tier | Cost | What You Get |
|------|------|--------------|
| **Trial** | $0 | $5 of free credits (trial period) |
| **Pro** | $20/month | Includes $20 of usage credits |
| **Usage** | ~$5-10/month | For your app (Next.js + MCP) |

**Total Expected Cost**: ~$10-15/month

---

## 🎉 Benefits Over Vercel

| Feature | Vercel | Railway |
|---------|--------|---------|
| Serverless | ✅ Yes | ❌ No (persistent) |
| STDIO MCP | ❌ No | ✅ Yes |
| Python subprocesses | ❌ No | ✅ Yes |
| 60s timeout | ⚠️ Yes | ✅ No limit |
| WebSockets | ⚠️ Limited | ✅ Full support |
| Cold starts | ⚠️ Yes | ✅ No |

---

## 📚 Resources

- **Railway Docs**: https://docs.railway.app/
- **Railway Discord**: https://discord.gg/railway (great support!)
- **Next.js on Railway**: https://docs.railway.app/guides/nextjs

---

## 🚀 Quick Commands

```bash
# Install Railway CLI (optional)
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs
railway logs

# Open dashboard
railway open
```

---

## ✅ Final Checklist

Before deploying:
- [ ] GitHub repository pushed
- [ ] Railway account created
- [ ] Environment variables ready
- [ ] `railway.toml` created
- [ ] Code updated for production paths
- [ ] Committed and pushed changes

After deploying:
- [ ] Check Railway build logs
- [ ] Test Stock MCP Server page
- [ ] Verify Polygon MCP connection in logs
- [ ] Update DNS (optional - custom domain)

---

**Ready to deploy?** Just push your code and let Railway handle the rest! 🎉

