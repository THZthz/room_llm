import { generateText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createSummary, getAllClientTranscripts } from "@/lib/domain/messages";

export async function summarizeClients(clientIds?: number[]) {
  const transcripts = getAllClientTranscripts(20, clientIds);

  if (transcripts.length === 0) {
    throw new Error("No client conversations are available to summarize.");
  }

  const transcriptBlock = transcripts
    .map((entry) => `Client: ${entry.clientName}\n${entry.transcript || "No messages yet."}`)
    .join("\n\n---\n\n");

  const result = await generateText({
    model: getLanguageModel(),
    system:
      "You summarize multiple participant conversations for an in-room coordinator. Keep the summary concise, structured, and action-oriented.",
    prompt: `Summarize the following client conversations. Include major themes, blockers, unanswered questions, and short recommendations.\n\n${transcriptBlock}`
  });

  const summaryId = createSummary(
    `Room summary ${new Date().toLocaleString()}`,
    transcripts.map((entry) => entry.clientId),
    result.text,
    transcripts.reduce((total, entry) => total + (entry.transcript ? entry.transcript.split("\n").length : 0), 0)
  );

  return {
    id: summaryId,
    content: result.text,
    clientIds: transcripts.map((entry) => entry.clientId)
  };
}
