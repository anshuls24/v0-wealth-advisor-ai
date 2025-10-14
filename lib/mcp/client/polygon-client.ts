/**
 * Polygon.io MCP Client using STDIO Transport
 * Documentation: https://github.com/polygon-io/mcp_polygon
 * AI SDK MCP Integration: https://ai-sdk.dev/cookbook/node/mcp-tools
 */

import { experimental_createMCPClient } from "ai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { PolygonMCPConfig } from "./types";

export class PolygonMCPClient {
  private client: Awaited<
    ReturnType<typeof experimental_createMCPClient>
  > | null = null;
  private apiKey: string;
  private transport: "stdio" | "sse";
  private pythonPath: string;
  private isConnected: boolean = false;

  constructor(config: PolygonMCPConfig) {
    this.apiKey = config.apiKey;
    this.transport = config.transport || "stdio";
    
    // Environment-aware uvx path:
    // - Production (Railway, Render, etc.): 'uvx' is in PATH
    // - Local development: Use absolute path (Next.js doesn't inherit shell PATH)
    this.pythonPath = config.pythonPath || 
      (process.env.NODE_ENV === 'production' 
        ? 'uvx' 
        : '/Users/anshul/.local/bin/uvx');
    
    console.log(`🔍 Polygon MCP: Environment: ${process.env.NODE_ENV}, Using uvx path: ${this.pythonPath}`);
  }

  /**
   * Initialize the MCP client connection
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      console.log("🔗 Polygon MCP client already connected");
      return;
    }

    try {
      console.log("🚀 Connecting to Polygon MCP server via STDIO...");

      // Spawn the Polygon MCP server process
      const transport = new StdioClientTransport({
        command: this.pythonPath,
        args: [
          "--from",
          "git+https://github.com/polygon-io/mcp_polygon@v0.4.1",
          "mcp_polygon",
        ],
        env: {
          ...process.env,
          POLYGON_API_KEY: this.apiKey,
        },
      });

      this.client = await experimental_createMCPClient({
        transport,
      });

      this.isConnected = true;
      console.log("✅ Polygon MCP client connected successfully");
    } catch (error) {
      console.error("💥 Failed to connect to Polygon MCP server:", error);
      throw new Error(
        `Failed to connect to Polygon MCP server: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Disconnect the MCP client
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.close();
      this.client = null;
      this.isConnected = false;
      console.log("🔌 Polygon MCP client disconnected");
    } catch (error) {
      console.error("⚠️ Error during MCP client disconnect:", error);
    }
  }

  /**
   * Get all available Polygon tools
   * Returns tools that can be used with AI SDK's generateText/streamText
   */
  async getTools(): Promise<Record<string, any>> {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error("MCP client not initialized");
    }

    try {
      console.log("🔧 Retrieving Polygon MCP tools...");
      const tools = await this.client.tools();
      console.log(`✅ Retrieved ${Object.keys(tools).length} Polygon tools`);
      
      // Log available tools for debugging
      console.log("📋 Available Polygon tools:", Object.keys(tools).join(", "));
      
      return tools;
    } catch (error) {
      console.error("💥 Failed to retrieve Polygon tools:", error);
      throw new Error(
        `Failed to retrieve Polygon tools: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get the connection status
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the underlying MCP client instance
   */
  getClient() {
    return this.client;
  }
}

/**
 * Singleton instance for Polygon MCP client
 */
let polygonClientInstance: PolygonMCPClient | null = null;

/**
 * Get or create a Polygon MCP client instance
 */
export function getPolygonMCPClient(apiKey?: string): PolygonMCPClient {
  if (!polygonClientInstance) {
    const key = apiKey || process.env.POLYGON_API_KEY;

    if (!key) {
      throw new Error(
        "POLYGON_API_KEY not found. Please set it in .env.local or pass it to getPolygonMCPClient()"
      );
    }

    polygonClientInstance = new PolygonMCPClient({ apiKey: key });
  }

  return polygonClientInstance;
}

/**
 * Reset the singleton instance (useful for testing or reconfiguration)
 */
export function resetPolygonMCPClient(): void {
  if (polygonClientInstance) {
    polygonClientInstance.disconnect().catch(console.error);
    polygonClientInstance = null;
  }
}

