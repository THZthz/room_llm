import path from "node:path";
import { z } from "zod";

const configSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default("./data/app.sqlite"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  AI_PROVIDER: z.enum(["openai", "anthropic", "deepseek", "openrouter"]).default("openai"),
  AI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com/v1"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  OPENROUTER_SITE_URL: z.string().optional(),
  OPENROUTER_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Room LLM Control"),
  NEXT_PUBLIC_DEVELOPMENT_MODE: z.coerce.boolean().default(true),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export type AppConfig = {
  host: string;
  port: number;
  databasePath: string;
  adminPassword: string;
  sessionSecret: string;
  aiProvider: "openai" | "anthropic" | "deepseek" | "openrouter";
  aiModel: string;
  openAiApiKey?: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;
  deepseekBaseUrl: string;
  openRouterApiKey?: string;
  openRouterBaseUrl: string;
  openRouterSiteUrl?: string;
  openRouterAppName?: string;
  appName: string;
  developmentMode: boolean;
  nodeEnv: "development" | "test" | "production";
};

let cachedConfig: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = configSchema.parse(process.env);
  cachedConfig = {
    host: parsed.HOST,
    port: parsed.PORT,
    databasePath: path.resolve(process.cwd(), parsed.DATABASE_PATH),
    adminPassword: parsed.ADMIN_PASSWORD,
    sessionSecret: parsed.SESSION_SECRET,
    aiProvider: parsed.AI_PROVIDER,
    aiModel: parsed.AI_MODEL,
    openAiApiKey: parsed.OPENAI_API_KEY,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    deepseekApiKey: parsed.DEEPSEEK_API_KEY,
    deepseekBaseUrl: parsed.DEEPSEEK_BASE_URL,
    openRouterApiKey: parsed.OPENROUTER_API_KEY,
    openRouterBaseUrl: parsed.OPENROUTER_BASE_URL,
    openRouterSiteUrl: parsed.OPENROUTER_SITE_URL,
    openRouterAppName: parsed.OPENROUTER_APP_NAME,
    appName: parsed.NEXT_PUBLIC_APP_NAME,
    developmentMode: parsed.NEXT_PUBLIC_DEVELOPMENT_MODE,
    nodeEnv: parsed.NODE_ENV
  };

  return cachedConfig;
}
