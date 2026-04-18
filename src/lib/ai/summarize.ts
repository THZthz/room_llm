import { generateText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createSummary, getAllClientTranscripts } from "@/lib/domain/messages";
import { messageTemplate } from "@/lib/ai/template";

export async function summarizeClients(clientIds?: number[]) {
  const transcripts = getAllClientTranscripts(20, clientIds);

  if (transcripts.length === 0) {
    throw new Error("No client conversations are available to summarize.");
  }

  const transcriptBlock = transcripts
    .map(
      (entry) =>
        `Client: ${entry.clientName}\n${entry.transcript || "No messages yet."}`,
    )
    .join("\n\n---\n\n");

  const result = await generateText({
    model: getLanguageModel(),
    system: messageTemplate(
      "你是一名老师的助教，他正在上课，你正在帮助这名老师，总结一些小组和其它助教的对话。**注意**：你的对话对象的身份是老师，审慎地考虑你的语气与回答偏向。",
      "你的回答会按照commonmark标准被渲染，然后呈现给用户——即老师，参考以下样本，让你的回答更清晰。此外，你的回答中**绝不**应该包含*latex*格式的代码，因为它们不会被正确渲染。\n\n**注意**：下面的样本是老师所使用的，你作为老师的助教，适当考虑你应该如何回答，和你对话的只有老师。",
    ),
    prompt: `## 小组对话内容\n\n${transcriptBlock}`,
  });

  const summaryId = createSummary(
    `总结 ${new Date().toLocaleString()}`,
    transcripts.map((entry) => entry.clientId),
    result.text,
    transcripts.reduce(
      (total, entry) =>
        total + (entry.transcript ? entry.transcript.split("\n").length : 0),
      0,
    ),
  );

  return {
    id: summaryId,
    content: result.text,
    clientIds: transcripts.map((entry) => entry.clientId),
  };
}
