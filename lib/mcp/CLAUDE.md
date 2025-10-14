# MCP (Model Context Protocol) Integration

This directory contains MCP client abstractions for connecting to remote MCP servers.

## Critical Rule

**ALWAYS fetch and read the provided documentation before implementing any MCP-related code.**

## Documentation

### AI SDK MCP Tools Integration

https://ai-sdk.dev/cookbook/node/mcp-tools

This documentation covers:

- How to create MCP clients with AI SDK
- SSE, stdio, and HTTP transport options
- Tool retrieval and combination patterns
- Integration with `generateText()` and `streamText()`
- Best practices for MCP client management

### Polygon.io MCP Server

https://github.com/polygon-io/mcp_polygon

Official Polygon.io MCP server providing access to comprehensive financial market data:
- Stock, options, forex, and crypto aggregates
- Real-time and historical trades and quotes
- Market snapshots and ticker details
- Dividends, splits, and financial fundamentals

## Usage Pattern

1. Read the documentation links above before making changes
2. Follow the existing patterns in `/lib/mcp/client/`
3. Use STDIO transport for locally-run MCP servers (like Polygon)
4. Use SSE transport for hosted MCP servers (like Firecrawl)
5. Always handle errors and add logging
6. Load credentials from environment variables

## Important Tips

- **Never disconnect MCP clients during streaming**: When using `streamText()`, tools may be called during the stream. Closing the client prematurely causes "closed client" errors.
- **Singleton pattern for connection reuse**: Use the singleton to maintain persistent connections across requests for better performance.
- **Type compatibility**: Use `Record<string, any>` for tool return types to ensure compatibility with AI SDK's `streamText()`.
- **STDIO process management**: For STDIO transport, ensure proper cleanup of spawned processes to avoid zombie processes.

