import { NextResponse, type NextRequest } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { isAdminRequest } from "@/lib/auth/admin";
import {
  getAllClientTranscripts,
  getRecentSummaries,
  saveMessage,
} from "@/lib/domain/messages";
import { messageTemplate } from "@/lib/ai/template";

const bodySchema = z.object({
  prompt: z.string().min(1).max(6000),
  contextMode: z.enum(["none", "summary", "full"]).default("summary"),
  clientIds: z.array(z.number().int().positive()).optional(),
});

function buildContext(
  contextMode: "none" | "summary" | "full",
  clientIds?: number[],
) {
  if (contextMode === "summary") {
    const summaries = getRecentSummaries(5).filter((summary) => {
      if (!clientIds?.length) {
        return true;
      }

      return summary.targetClientIds.some((clientId) =>
        clientIds.includes(clientId),
      );
    });
    return summaries.length === 0
      ? "目前没有可用的总结。"
      : summaries
          .map((summary) => `${summary.title}\n${summary.content}`)
          .join("\n\n---\n\n");
  }

  if (contextMode === "full") {
    const transcripts = getAllClientTranscripts(12, clientIds);
    return transcripts.length === 0
      ? "目前还没有可用的小组笔录。"
      : transcripts
          .map(
            (entry) =>
              `${entry.clientName}\n${entry.transcript || "目前没有消息。"}`,
          )
          .join("\n\n---\n\n");
  }

  return "没有可用的语境";
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
      system: messageTemplate(
        "你是一名老师的助教，他正在上课，你正在帮助这名老师，此外你可能会知道一些小组和其它助教的对话。**注意**：你的对话对象的身份是老师，审慎地考虑你的语气与回答偏向。",
        "你的回答会按照commonmark标准被渲染，然后呈现给用户——即老师，参考以下样本，让你的回答更清晰。此外，你的回答中**绝不**应该包含*latex*格式的代码，因为它们不会被正确渲染。\n\n**注意**：下面的样本是老师所使用的，你作为老师的助教，适当考虑你应该如何回答，和你对话的只有老师。",
      ),
      prompt: `## 上下文模式: ${body.contextMode}\n\n## 上下文内容\n${context}\n\n## 老师的要求\n${body.prompt}`,
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
        },
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete admin chat.",
      },
      { status: 400 },
    );
  }
}
