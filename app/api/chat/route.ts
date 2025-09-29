export const maxDuration = 30

// Seamlessly forward legacy /api/chat calls to the correct endpoint
import { POST as conversationPOST } from "@/app/api/conversation/route"

export async function POST(req: Request) {
  // Delegate to the main conversation handler
  return conversationPOST(req)
}

export async function GET() {
  return new Response(
    JSON.stringify({
      message: "/api/chat is forwarded internally to /api/conversation.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}


