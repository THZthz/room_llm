import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth/admin";
import { summarizeClients } from "@/lib/ai/summarize";
import { getRecentSummaries } from "@/lib/domain/messages";
import { logAdminAction } from "@/lib/domain/system";

const bodySchema = z.object({
  clientIds: z.array(z.number().int().positive()).optional()
});

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ summaries: getRecentSummaries() });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const summary = await summarizeClients(body.clientIds);
    logAdminAction("summarize-clients", { summaryId: summary.id, clientIds: summary.clientIds });

    return NextResponse.json({
      summary: {
        id: summary.id,
        title: `Room summary ${new Date().toLocaleString()}`,
        content: summary.content,
        createdAt: new Date().toISOString()
      },
      summaries: getRecentSummaries()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to summarize conversations." },
      { status: 400 }
    );
  }
}
