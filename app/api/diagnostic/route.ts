import { NextResponse } from 'next/server';
import { getPolygonMCPClient } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    apiKeys: {
      openai: !!process.env.OPENAI_API_KEY,
      polygon: !!process.env.POLYGON_API_KEY,
      vectorize_token: !!process.env.VECTORIZE_PIPELINE_ACCESS_TOKEN,
      vectorize_org: !!process.env.VECTORIZE_ORGANIZATION_ID,
      vectorize_pipeline: !!process.env.VECTORIZE_PIPELINE_ID,
    },
    mcp: {
      status: 'unknown',
      error: null,
      tools: [],
    },
  };

  // Test MCP connection
  if (process.env.NODE_ENV === 'production' && process.env.POLYGON_API_KEY) {
    try {
      console.log('🧪 Diagnostic: Testing MCP connection...');
      const polygonClient = getPolygonMCPClient();
      await polygonClient.connect();
      const tools = await polygonClient.getTools();
      diagnostics.mcp.status = 'connected';
      diagnostics.mcp.tools = Object.keys(tools);
      console.log('✅ Diagnostic: MCP connected successfully');
    } catch (error) {
      diagnostics.mcp.status = 'failed';
      diagnostics.mcp.error = error instanceof Error ? error.message : String(error);
      console.error('❌ Diagnostic: MCP connection failed:', error);
    }
  } else {
    diagnostics.mcp.status = 'skipped (dev mode or no API key)';
  }

  return NextResponse.json(diagnostics, { status: 200 });
}

