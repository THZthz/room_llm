import { NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { getSessionByToken } from "@/lib/domain/clients";
import { getClientMessages, saveMessage } from "@/lib/domain/messages";
import { getLiveState } from "@/lib/state/live";

const bodySchema = z.object({
  sessionToken: z.string().uuid(),
  message: z.string().min(1).max(4000)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const session = getSessionByToken(body.sessionToken);

    if (!session) {
      return NextResponse.json({ error: "Session expired. Register again." }, { status: 401 });
    }

    if (!getLiveState().isLlmEnabled()) {
      return NextResponse.json({ error: "The server has disabled client LLM access." }, { status: 403 });
    }

    saveMessage("client", "user", body.message, session.clientId);
    const history = getClientMessages(session.clientId, 20)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n");

    const result = streamText({
      model: getLanguageModel(),
      system: `You are a helpful assistant for ${session.clientName}. Keep answers concise and practical.`,
      prompt: `Conversation so far:\n${history}\n\nRespond to the latest user message.`
    });

    const encoder = new TextEncoder();
    let fullText = "";

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.textStream) {
              fullText += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            if (fullText.trim()) {
              saveMessage("client", "assistant", fullText, session.clientId);
            }

            controller.close();
          } catch (streamError) {
            controller.error(streamError);
          }
        }
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send message." },
      { status: 400 }
    );
  }
}
