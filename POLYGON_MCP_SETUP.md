# Polygon.io MCP Server Integration

This document explains how the Stock Advisor agent uses Polygon.io's MCP (Model Context Protocol) server to provide real-time market data.

## Overview

The Stock Advisor agent integrates with [Polygon.io's official MCP server](https://github.com/polygon-io/mcp_polygon) to provide:

- Real-time stock prices and market data
- Historical OHLC (Open, High, Low, Close) data
- Company fundamentals and financial statements
- Market news and ticker details
- Trade and quote history
- Market status and trading hours

## Prerequisites

### 1. Polygon.io API Key

Get a free or paid API key from [Polygon.io](https://polygon.io):
- Free tier: 5 API calls/minute
- Starter tier ($29/month): Unlimited calls, 1-year historical data
- Developer tier ($99/month): Unlimited calls, 2-year historical data

Sign up at: https://polygon.io/dashboard/signup

### 2. Python/uvx Installation

The Polygon MCP server is a Python application that runs via `uvx`. You need:

**Option A: Install uv (Recommended)**
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Verify installation
uvx --version
```

**Option B: Use existing Python**
```bash
# Ensure Python 3.10+ is installed
python --version

# Install uv
pip install uv
```

## Environment Variables

Add these to your `.env.local` file:

```bash
# Polygon.io API Key (Required)
POLYGON_API_KEY=your_polygon_api_key_here

# Optional: Path to uvx if not in PATH
# UVX_PATH=/path/to/uvx
```

### Getting Your API Key

1. Sign up at https://polygon.io/dashboard/signup
2. Navigate to https://polygon.io/dashboard/api-keys
3. Copy your API key
4. Add it to `.env.local` as `POLYGON_API_KEY`

## How It Works

### Architecture

```
User Query
    ↓
Stock Advisor Frontend (/stock-advisor)
    ↓
API Route (/api/stock-advisor)
    ↓
Polygon MCP Client (lib/mcp/client/polygon-client.ts)
    ↓
Spawns Polygon MCP Server Process (Python via uvx)
    ↓
STDIO Transport (bidirectional communication)
    ↓
Polygon.io REST API
    ↓
Real-time Market Data
    ↓
AI Agent synthesizes and responds
```

### Transport Protocol

The integration uses **STDIO transport**:
- Node.js spawns the Python MCP server as a child process
- Communication happens via stdin/stdout
- Process is kept alive for the duration of the API request
- Automatically cleaned up after response

### Available Tools

When you connect to the Polygon MCP server, the agent gets access to these tools:

| Tool Name | Description | Example Use Case |
|-----------|-------------|------------------|
| `get_aggs` | OHLC aggregates/bars | "Show me AAPL's price chart for the last week" |
| `get_snapshot_ticker` | Current market snapshot | "What's TSLA trading at right now?" |
| `get_last_trade` | Most recent trade | "What was the last trade for NVDA?" |
| `list_trades` | Historical trades | "Show me all trades for MSFT today" |
| `get_previous_close` | Previous day close | "What did AAPL close at yesterday?" |
| `list_ticker_news` | Company news | "Any recent news on Tesla?" |
| `get_market_status` | Market open/closed | "Are markets open right now?" |
| `list_stock_financials` | Financial statements | "Show me AAPL's revenue and earnings" |
| `get_ticker_details` | Company details | "Tell me about Nvidia's business" |

## Testing the Integration

### 1. Install Dependencies

```bash
# Install npm packages (includes MCP SDK)
npm install
# or
pnpm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Access Stock Advisor

Navigate to: http://localhost:3000/stock-advisor

### 4. Test Queries

Try these example queries:

**Basic Queries:**
- "What's AAPL trading at?"
- "Show me TSLA's price action today"
- "Is the market open?"

**Technical Analysis:**
- "Analyze NVDA's recent trend"
- "What's the support level for AMD?"
- "Show me AAPL's 50-day moving average"

**Fundamental Analysis:**
- "What are TSLA's recent financials?"
- "Tell me about Microsoft's revenue growth"
- "What sector is NVDA in?"

**News & Research:**
- "Any news on Apple?"
- "Why is Tesla stock moving today?"
- "What are analysts saying about AMD?"

## Troubleshooting

### Error: "uvx: command not found"

**Solution:** Install uv/uvx:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Make sure `uvx` is in your PATH:
```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"
```

### Error: "POLYGON_API_KEY not found"

**Solution:** Add your API key to `.env.local`:
```bash
POLYGON_API_KEY=your_key_here
```

Restart the dev server after adding environment variables.

### Error: "Failed to connect to Polygon MCP server"

**Possible causes:**
1. **uvx not installed** - Install uv as shown above
2. **Python not available** - Ensure Python 3.10+ is installed
3. **Network issues** - Check internet connection
4. **API key invalid** - Verify your Polygon.io API key

**Debug steps:**
```bash
# Test uvx manually
uvx --version

# Test Polygon MCP server directly
uvx --from git+https://github.com/polygon-io/mcp_polygon@v0.4.1 mcp_polygon
```

### Error: "Rate limit exceeded"

**Solution:** You've hit the API rate limit:
- Free tier: 5 calls/minute
- Upgrade to a paid plan for unlimited calls
- Wait a minute and try again

### Server logs show "Tool execution failed"

Check the console logs for specific errors. Common issues:
- **Invalid ticker symbol** - Use correct symbols (e.g., "AAPL" not "Apple")
- **Market closed** - Some endpoints return less data when markets are closed
- **Historical data unavailable** - Free tier has limited historical access

## Performance Notes

### First Request Latency

The first request to the Stock Advisor may take 3-5 seconds because:
1. MCP client spawns the Python process
2. Process installs dependencies if needed
3. Establishes connection to Polygon.io

**Subsequent requests are faster** as the client connection is maintained.

### Connection Persistence

The Polygon MCP client uses a **singleton pattern**:
- Connection is reused across requests
- Reduces overhead
- Improves performance

### Process Cleanup

The MCP server process is automatically cleaned up when:
- API request completes
- Server shuts down
- Connection times out (60 seconds)

## Advanced Configuration

### Custom Server Path

If you want to run the Polygon MCP server from a specific location:

```typescript
// lib/mcp/client/polygon-client.ts
const polygonClient = new PolygonMCPClient({
  apiKey: process.env.POLYGON_API_KEY!,
  pythonPath: "/custom/path/to/uvx",
  serverPath: "/custom/path/to/mcp_polygon",
});
```

### SSE Transport (Alternative)

If you prefer to run the MCP server separately and connect via SSE:

1. Start the server:
```bash
MCP_TRANSPORT=sse POLYGON_API_KEY=your_key uv run entrypoint.py
```

2. Update the client:
```typescript
const polygonClient = new PolygonMCPClient({
  apiKey: process.env.POLYGON_API_KEY!,
  transport: "sse",
  serverUrl: "http://localhost:8000/sse",
});
```

## Resources

- **Polygon.io MCP Server**: https://github.com/polygon-io/mcp_polygon
- **Polygon.io API Docs**: https://polygon.io/docs
- **Model Context Protocol**: https://modelcontextprotocol.io
- **AI SDK MCP Integration**: https://ai-sdk.dev/cookbook/node/mcp-tools
- **Astral uv**: https://docs.astral.sh/uv/

## Support

- **Polygon.io Support**: support@polygon.io
- **MCP Issues**: https://github.com/polygon-io/mcp_polygon/issues
- **API Status**: https://status.polygon.io

## Upgrade Options

Consider upgrading your Polygon.io plan for:
- **Unlimited API calls** - No rate limiting
- **More historical data** - Up to 15 years
- **Options data** - Options chains and Greeks
- **Forex & Crypto** - Multi-asset coverage
- **Real-time L2 data** - Order book depth

Plans: https://polygon.io/pricing

