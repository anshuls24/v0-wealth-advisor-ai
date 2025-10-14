/**
 * TypeScript types for MCP client configurations
 */

export interface MCPClientConfig {
  apiKey: string;
  serverUrl?: string;
}

export interface PolygonMCPConfig {
  apiKey: string;
  transport?: "stdio" | "sse";
  serverUrl?: string; // For SSE transport
  pythonPath?: string; // Path to Python/uvx executable
  serverPath?: string; // Path to MCP server script
}

