import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionByToken } from "@/lib/domain/clients";
import { getClientMessages } from "@/lib/domain/messages";
import { getLiveState } from "@/lib/state/live";

const bodySchema = z.object({
  sessionToken: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const session = getSessionByToken(body.sessionToken);

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({
      sessionToken: session.sessionToken,
      clientId: session.clientId,
      clientName: session.clientName,
      messages: getClientMessages(session.clientId),
      llmEnabled: getLiveState().isLlmEnabled()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load session." },
      { status: 400 }
    );
  }
}
