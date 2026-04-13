import { NextResponse, type NextRequest } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { isAdminRequest } from "@/lib/auth/admin";
import { getAllClientTranscripts, getRecentSummaries, saveMessage } from "@/lib/domain/messages";

const bodySchema = z.object({
  prompt: z.string().min(1).max(6000),
  contextMode: z.enum(["none", "summary", "full"]).default("summary"),
  clientIds: z.array(z.number().int().positive()).optional()
});

function buildContext(contextMode: "none" | "summary" | "full", clientIds?: number[]) {
  if (contextMode === "summary") {
    const summaries = getRecentSummaries(5).filter((summary) => {
      if (!clientIds?.length) {
        return true;
      }

      return summary.targetClientIds.some((clientId) => clientIds.includes(clientId));
    });
    return summaries.length === 0
      ? "No summaries are available yet."
      : summaries.map((summary) => `${summary.title}\n${summary.content}`).join("\n\n---\n\n");
  }

  if (contextMode === "full") {
    const transcripts = getAllClientTranscripts(12, clientIds);
    return transcripts.length === 0
      ? "No client transcripts are available yet."
      : transcripts.map((entry) => `${entry.clientName}\n${entry.transcript || "No messages yet."}`).join("\n\n---\n\n");
  }

  return "No client context requested.";
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const context = buildContext(body.contextMode, body.clientIds);

    saveMessage("admin", "user", body.prompt);

    const result = streamText({
      model: getLanguageModel(),
      system: "You are assisting the room operator. Keep the answer structured, concise, and operationally useful.",
      prompt: `Client context mode: ${body.contextMode}\n\nContext:\n${context}\n\nOperator request:\n${body.prompt}`
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
              saveMessage("admin", "assistant", fullText);
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
      { error: error instanceof Error ? error.message : "Unable to complete admin chat." },
      { status: 400 }
    );
  }
}
