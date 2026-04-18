import { NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { getSessionByToken } from "@/lib/domain/clients";
import { getClientMessages, saveMessage } from "@/lib/domain/messages";
import { getLiveState } from "@/lib/state/live";
import { messageTemplate } from "@/lib/ai/template";

const bodySchema = z.object({
  sessionToken: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const session = getSessionByToken(body.sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: "Session expired. Register again." },
        { status: 401 },
      );
    }

    if (!getLiveState().isLlmEnabled()) {
      return NextResponse.json(
        { error: "The server has disabled client LLM access." },
        { status: 403 },
      );
    }

    saveMessage("client", "user", body.message, session.clientId);
    const history = getClientMessages(session.clientId, 20)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n");

    const result = streamText({
      model: getLanguageModel(),
      system: messageTemplate(
        `你是一名老师的助教，他正在上课，你正在帮助这名老师，与一组小学学生进行对话（他们给他们小组的名字是“${session.clientName}”），引导他们入门除法算式。你的回答应生动、且具有引导性。**注意**：你的对话对象的身份一直是小学学生，审慎地考虑你的语气与回答偏向。`,
        "你的回答会按照commonmark标准被渲染，然后呈现给用户——即学生，参考以下样本，让你的回答更清晰。此外，你的回答中**绝不**应该包含*latex*格式的代码，因为它们不会被正确渲染。\n\n**注意**：下面的样本是老师所使用的，你作为老师的助教，适当考虑你应该如何回答，和你对话的只有学生。",
      ),
      prompt: `## 截止目前的对话（回答最近一次的学生的问题）\n${history}\n\n`,
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
          error instanceof Error ? error.message : "Unable to send message.",
      },
      { status: 400 },
    );
  }
}
