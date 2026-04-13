import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientMessages } from "@/lib/domain/messages";
import { registerClient } from "@/lib/domain/clients";
import { getLiveState } from "@/lib/state/live";

const bodySchema = z.object({
  name: z.string().min(2).max(32)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const session = registerClient(body.name);

    return NextResponse.json({
      sessionToken: session.sessionToken,
      clientId: session.clientId,
      clientName: session.clientName,
      messages: getClientMessages(session.clientId),
      llmEnabled: getLiveState().isLlmEnabled()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to register client." },
      { status: 400 }
    );
  }
}
