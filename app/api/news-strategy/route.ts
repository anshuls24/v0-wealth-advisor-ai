import { NextRequest } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { retrieveDocumentsTool } from "@/components/agent/tools/retrieve-documents";
import { getPolygonMCPClient } from "@/lib/mcp";

// Explicit model client with API key for production
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { ticker, newsText, userProfile, limit = 3 } = await req.json();

    if (!ticker && !newsText) {
      return new Response(
        JSON.stringify({ error: "ticker or newsText is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let combinedNews: string | null = (newsText || "").toString().trim() || null;

    // If running on Railway (production) and ticker provided, try fetching latest news via Polygon MCP
    if (ticker && process.env.NODE_ENV === "production") {
      try {
        const polygon = getPolygonMCPClient();
        await polygon.connect();
        const tools = await polygon.getTools();

        if (tools?.list_ticker_news?.execute) {
          const res = await tools.list_ticker_news.execute({ ticker, limit });
          const articles: any[] = res?.results || res?.articles || [];
          const text = articles
            .slice(0, limit)
            .map((a, i) => `(${i + 1}) ${a.title || a.headline}\n${a.description || a.summary || ""}\nSource: ${a.url || a.source || ""}`)
            .join("\n\n");
          if (text) combinedNews = combinedNews ? `${combinedNews}\n\n${text}` : text;
        }
      } catch (err) {
        console.warn("⚠️ Polygon news fetch failed, using provided newsText only:", err);
      }
    }

    if (!combinedNews) {
      return new Response(
        JSON.stringify({ error: "No news content available. Provide newsText or enable Polygon on Railway." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build profile-aware constraints
    const profileContext = userProfile ? `
## USER PROFILE CONSTRAINTS:
- Risk Tolerance: ${userProfile.risk?.tolerance || 'unknown'}
- Options Experience: ${userProfile.options?.experience_level || 'unknown'}
- Assignment Tolerance: ${userProfile.options?.assignment_tolerance ? 'Yes' : 'No'}
- Greeks Familiarity: ${userProfile.options?.greeks_familiarity ? 'Yes' : 'No'}
- Strategy Preference: ${userProfile.options?.strategy_preference || 'none specified'}
- Directional Bias: ${userProfile.options?.directional_bias || 'none specified'}
- Preferred Underlyings: ${userProfile.options?.preferred_underlyings?.join(', ') || 'none specified'}
- IV Comfort: ${userProfile.options?.iv_comfort || 'unknown'}
- Holding Period: ${userProfile.options?.holding_period_days || 'unknown'} days
- Risk Structure: ${userProfile.options?.risk_structure_preference || 'unknown'}
- Learning Style: ${userProfile.options?.learning_style || 'unknown'}
` : '';

    const system = `
You recommend options STRATEGIES (not trade executions). Use the provided user profile to constrain choices.
${profileContext}
Pipeline:
1) From the news: extract direction (bullish/bearish/neutral), iv_regime (low/mod/high), horizon_days, catalyst_date?, confidence 0–1.
2) Query the strategy library via retrieval tool for the best 1–2 strategies matching direction + iv + horizon + user profile.
3) Adapt for the user's profile:
   - low risk → defined-risk only; no naked short options
   - beginner → simple verticals/iron condor; prefer index ETFs if user is conservative
   - short horizon → 7–21 DTE; long horizon → 30–60 DTE
   - no assignment tolerance → avoid short puts/calls without protection
   - small capital → debit spreads over wide credit structures
   - match strategy_preference (credit vs debit vs condors)
   - match directional_bias if specified
   - use preferred_underlyings if specified
   - respect iv_comfort (high/low/moderate)
4) Output sections (concise, ≤10 bullets total): Strategy; Why it fits (reference profile); Entry (strike/expiry rules); Risk; Exit/targets; Alternatives (1 line); Brief disclaimer.
Educational only; no financial advice; no prices/greeks.
`;

    const userMsg = {
      role: "user" as const,
      content: `Ticker: ${ticker || "N/A"}
UserProfile: ${JSON.stringify(userProfile || {})}
News:\n${combinedNews}

1) Extract signal.
2) Retrieve best-fit strategies from the library.
3) Tailor the description to the profile.`,
    };

    const tools = {
      retrieveDocuments: retrieveDocumentsTool,
    } as const;

    const result = await streamText({
      model: openai("gpt-4o-mini"),
      system,
      messages: [userMsg],
      tools,
      temperature: 0.4,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("💥 news-strategy error:", error);

    // Plan/permissions guidance
    if (typeof error?.message === "string" && error.message.includes("NOT_AUTHORIZED")) {
      return new Response(
        JSON.stringify({
          error: "Your Polygon plan likely does not include this data. Try providing newsText manually or use SPY as proxy.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to generate strategy from news." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}


