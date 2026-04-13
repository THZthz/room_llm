import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { getConfig } from "@/lib/config";

export function getLanguageModel() {
  const config = getConfig();

  if (config.aiProvider === "anthropic") {
    if (!config.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    return createAnthropic({ apiKey: config.anthropicApiKey })(config.aiModel);
  }

  if (config.aiProvider === "deepseek") {
    if (!config.deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }

    return createOpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: config.deepseekBaseUrl
    })(config.aiModel);
  }

  if (config.aiProvider === "openrouter") {
    if (!config.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const headers: Record<string, string> = {};
    if (config.openRouterSiteUrl) {
      headers["HTTP-Referer"] = config.openRouterSiteUrl;
    }
    if (config.openRouterAppName) {
      headers["X-Title"] = config.openRouterAppName;
    }

    return createOpenAI({
      apiKey: config.openRouterApiKey,
      baseURL: config.openRouterBaseUrl,
      headers
    })(config.aiModel);
  }

  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return createOpenAI({ apiKey: config.openAiApiKey })(config.aiModel);
}
