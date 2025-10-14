# 🚀 Deploy Stock-AI Advisor to Render

Render is an **excellent platform** for deploying your Stock-AI Advisor with Polygon MCP integration. It supports persistent processes, Python subprocesses, and has a generous free tier!

---

## 📋 Prerequisites

- GitHub repository (you already have this)
- Render account (free to sign up)
- Environment variables ready:
  - `OPENAI_API_KEY`
  - `POLYGON_API_KEY`

---

## 🎨 Step-by-Step Deployment

### **1. Create Render Account**
Go to: https://render.com
- Click **"Get Started"** or **"Sign Up"**
- Choose **"Sign up with GitHub"**
- Authorize Render to access your repositories

### **2. Create New Web Service**
1. Click **"New +"** button in the top right
2. Select **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Find and select: `anshuls24/v0-wealth-advisor-ai`
5. Click **"Connect"**

### **3. Configure Your Service**

Render will show a configuration form. Fill it out:

#### **Basic Settings:**
- **Name**: `stock-ai-advisor` (or your preferred name)
- **Region**: Choose closest to you:
  - 🇺🇸 `Oregon (US West)`
  - 🇺🇸 `Ohio (US East)`
  - 🇪🇺 `Frankfurt (Europe)`
  - 🇸🇬 `Singapore (Asia)`
- **Branch**: `main`
- **Root Directory**: Leave blank
- **Environment**: `Node`

#### **Build & Start Commands:**
Render should auto-detect from `render.yaml`, but if not, use:

**Build Command:**
```bash
apt-get update && apt-get install -y python3 python3-pip && pip3 install uv && npm install -g pnpm && pnpm install && pnpm build
```

**Start Command:**
```bash
pnpm start
```

#### **Plan:**
- **Free**: 750 hours/month (sleeps after 15 min inactivity) - **Great for testing!**
- **Starter ($7/month)**: Always on, better performance - **Recommended**

### **4. Add Environment Variables**

In the "Environment Variables" section:

```bash
NODE_ENV=production
OPENAI_API_KEY=sk-... # Your actual OpenAI API key
POLYGON_API_KEY=your_polygon_key # Your actual Polygon.io API key
```

**Important**: Don't commit these to GitHub! Set them in Render dashboard only.

### **5. Deploy!**

1. Click **"Create Web Service"** at the bottom
2. Render will start building your app (takes ~5-10 minutes first time)
3. Watch the build logs in real-time
4. Once deployed, you'll see: **"Your service is live at https://stock-ai-advisor.onrender.com"**

---

## ✅ Verify Deployment

### **1. Check Build Logs**
Look for these success indicators:
```
==> Installing Python and uv...
==> Running 'pnpm install'...
==> Running 'pnpm build'...
==> Build successful!
==> Starting service...
✓ Ready in 1234ms
```

### **2. Test Your App**
1. Go to your Render URL: `https://your-app-name.onrender.com`
2. Navigate to **Stock MCP Server** page
3. Ask: "What was AAPL's closing price yesterday?"

### **3. Check Logs for MCP Connection**
In Render Dashboard → **"Logs"** tab, look for:
```
✅ Polygon MCP client connected successfully
✅ Retrieved 53 Polygon tools
🔧 Tool Called: get_previous_close_agg
✅ Success
```

---

## 🔧 Troubleshooting

### **Issue: `spawn uvx ENOENT`**
**Cause**: Python/uv not installed during build.

**Solution**: Update build command in Render Dashboard:
```bash
apt-get update && apt-get install -y python3 python3-pip && pip3 install uv && npm install -g pnpm && pnpm install && pnpm build
```

### **Issue: Build Fails - "pnpm: command not found"**
**Solution**: Build command should install pnpm first:
```bash
npm install -g pnpm && pnpm install && pnpm build
```

### **Issue: App Works but MCP Server Fails**
**Cause**: Environment variables not set correctly.

**Solution**: 
1. Go to Render Dashboard → Your Service → **"Environment"** tab
2. Verify both `OPENAI_API_KEY` and `POLYGON_API_KEY` are set
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

### **Issue: "Service Unavailable" / App Sleeps (Free Plan)**
**Cause**: Free tier sleeps after 15 minutes of inactivity.

**Solutions**:
- **Option 1**: Upgrade to Starter plan ($7/month) - no sleep
- **Option 2**: Use a service like [UptimeRobot](https://uptimerobot.com/) to ping your app every 5 minutes
- **Option 3**: Accept the 30-60 second cold start delay

### **Issue: Slow Initial Load**
**Cause**: Cold start (especially on free tier).

**Solution**: Render's cold starts are ~30-60 seconds. This is normal for free tier. Upgrade to Starter for instant response.

---

## 💰 Pricing Comparison

| Tier | Cost | Features | Best For |
|------|------|----------|----------|
| **Free** | $0 | 750 hrs/month, sleeps after 15 min | Testing, demos |
| **Starter** | $7/month | Always on, 512MB RAM, 0.5 CPU | Production (recommended) |
| **Standard** | $25/month | 2GB RAM, 1 CPU | High traffic |

**Recommended for your app**: **Starter ($7/month)** for always-on performance.

---

## 🎉 Advanced Features

### **1. Custom Domain**
1. Go to your service → **"Settings"** → **"Custom Domains"**
2. Add your domain (e.g., `stockai.yourdomain.com`)
3. Update DNS records (Render provides instructions)
4. SSL certificate auto-provisioned!

### **2. Auto-Deploy on Git Push**
Already enabled! Every push to `main` triggers automatic deployment.

To disable:
1. Go to **"Settings"** → **"Build & Deploy"**
2. Toggle **"Auto-Deploy"** off

### **3. Manual Deploy**
In Render Dashboard:
1. Go to your service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

### **4. View Logs**
Real-time logs available in:
1. **Render Dashboard** → Your Service → **"Logs"** tab
2. Or use Render CLI:
   ```bash
   npm install -g render-cli
   render login
   render logs
   ```

### **5. Environment-Specific Configs**
Create different services for staging vs production:
- `stock-ai-advisor-staging` (free tier, branch: `develop`)
- `stock-ai-advisor-production` (starter tier, branch: `main`)

---

## 🔄 CI/CD Workflow

Your setup now includes:

```
Developer Workflow:
1. Code changes locally
2. Test on localhost:3000
3. git push origin main
4. Render auto-detects push
5. Builds and deploys automatically
6. Verifies health check
7. New version live! 🎉
```

**Rollback**: If deploy fails, Render keeps previous version running!

---

## 📊 Monitoring & Metrics

Render provides built-in monitoring:

1. **Metrics Tab**:
   - CPU usage
   - Memory usage
   - Response times
   - Request counts

2. **Logs Tab**:
   - Real-time application logs
   - Build logs
   - Deployment history

3. **Alerts** (Pro plan):
   - Set up alerts for downtime
   - Email/Slack notifications

---

## 🆚 Render vs Railway vs Vercel

| Feature | Render | Railway | Vercel |
|---------|--------|---------|--------|
| **STDIO MCP Support** | ✅ Yes | ✅ Yes | ❌ No |
| **Free Tier** | ✅ 750 hrs/month | ⚠️ $5 trial | ✅ Generous |
| **Paid Plan Start** | $7/month | $20/month | Free (most apps) |
| **Python Support** | ✅ Native | ✅ Native | ❌ No |
| **Cold Starts (Free)** | ~30-60s | ❌ N/A | <1s |
| **Custom Domains** | ✅ Free | ✅ Free | ✅ Free |
| **Auto SSL** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Build Time** | 5-10 min | 3-5 min | 1-3 min |
| **Learning Curve** | ⭐⭐⭐ Easy | ⭐⭐⭐ Easy | ⭐⭐ Easiest |

**Verdict**: 
- **Render = Best value** ($7/month always-on)
- **Railway = Best DX** (developer experience)
- **Vercel = Best for frontend** (but no MCP support)

---

## 🚨 Important Notes

### **1. Environment Variables**
❌ **NEVER commit API keys to GitHub!**
✅ **ALWAYS set them in Render Dashboard**

### **2. Free Tier Sleep**
Free tier services sleep after 15 minutes of inactivity. First request after sleep takes ~30-60 seconds to wake up. This is normal!

### **3. Build Duration**
First build takes longer (~10 minutes) because it installs Python, uv, pnpm, and all dependencies. Subsequent builds are faster (~3-5 minutes) thanks to caching.

### **4. Logs Retention**
Logs are retained for:
- **Free tier**: 7 days
- **Starter tier**: 7 days
- **Pro tier**: 30 days

### **5. Disk Space**
Render services have ephemeral disk storage. Files are not persisted across deploys. Use external storage (S3, Cloudinary) for uploads.

---

## 📚 Resources

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com/
- **Render Status**: https://status.render.com/
- **Next.js on Render**: https://render.com/docs/deploy-nextjs
- **Support**: support@render.com

---

## 📝 Quick Commands

### **Deploy from CLI (Optional)**
```bash
# Install Render CLI
npm install -g render-cli

# Login
render login

# Deploy
render deploy
```

### **View Logs**
```bash
render logs -f  # Follow logs in real-time
```

### **Open Dashboard**
```bash
render open
```

---

## ✅ Final Checklist

**Before deploying:**
- [ ] GitHub repository pushed with latest code
- [ ] Render account created
- [ ] `render.yaml` file committed
- [ ] Environment variables ready (OPENAI_API_KEY, POLYGON_API_KEY)

**After deploying:**
- [ ] Check build logs for success
- [ ] Test main chat advisor
- [ ] Test Stock MCP Server page
- [ ] Verify Polygon MCP connection in logs
- [ ] Test a few queries (AAPL price, news, etc.)
- [ ] Set up custom domain (optional)

---

## 🎉 You're Ready!

Render is now configured and ready to deploy your Stock-AI Advisor with full Polygon MCP functionality!

**Deploy now**: Just push to GitHub and Render will automatically build and deploy! 🚀

**Questions?** Check the troubleshooting section or visit [Render Community](https://community.render.com/).

---

**Pro Tip**: Start with the **free tier** to test everything, then upgrade to **Starter ($7/month)** for production use!

