import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

import {
  createOpenRouterClient,
  type ChatCompletionResponse,
  type OpenRouterClientOptions,
} from "./client";

export const DEFAULT_TEXT_MODEL = "openai/gpt-5-mini";
const DEFAULT_EMBEDDING_MODEL = "google/gemini-embedding-2";
const DEFAULT_EMBEDDING_DIMENSIONS = 3072;

type ChatRequest = NonNullable<Parameters<OpenRouter["chat"]["send"]>[0]["chatRequest"]>;
export type ChatUsage = ChatCompletionResponse["usage"];
export type ChatReasoningEffort = ChatRequest["reasoningEffort"];

type ChatCompletionOptions = OpenRouterClientOptions & {
  messages: ChatRequest["messages"];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ChatRequest["responseFormat"];
  tools?: ChatRequest["tools"];
  /** Constrains reasoning-model "thinking" tokens, which otherwise count against maxTokens and can starve the actual answer. */
  reasoningEffort?: ChatReasoningEffort;
};

type EmbeddingOptions = OpenRouterClientOptions & {
  inputType?: string;
  dimensions?: number;
};

const DIAGNOSTIC_HEADER_NAMES = [
  "request-id",
  "x-request-id",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
] as const;

const providerDetailsSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  message: z.string().optional(),
  type: z.string().optional(),
});

const providerBodySchema = z.object({
  error: providerDetailsSchema.optional(),
  code: z.union([z.number(), z.string()]).optional(),
  message: z.string().optional(),
  type: z.string().optional(),
});

const formattedErrorSchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
  body: z.unknown().optional(),
  error: providerDetailsSchema.optional(),
  headers: z.unknown().optional(),
});

type ProviderDetails = z.infer<typeof providerDetailsSchema>;

function parseProviderBody(value: unknown): ProviderDetails | null {
  if (typeof value !== "string" || value.length === 0) return null;

  try {
    const parsed = providerBodySchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;

    return parsed.data.error ?? parsed.data;
  } catch {
    return null;
  }
}

function safeProviderBody(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;

  const providerError = parseProviderBody(value);
  if (!providerError) return "[unrecognized provider response body]";

  const details = Object.fromEntries(
    Object.entries(providerError).filter(([, detail]) => detail !== undefined),
  );
  return Object.keys(details).length > 0
    ? JSON.stringify(details)
    : "[empty provider response details]";
}

/**
 * Preserves actionable provider diagnostics without serializing requests,
 * prompts, API keys, or arbitrary SDK internals into logs/database errors.
 */
export function formatAiError(error: unknown): string {
  const parsedError = formattedErrorSchema.safeParse(error);
  if (!parsedError.success) return String(error);

  const errorDetails = parsedError.data;

  const parts: string[] = [];
  if (errorDetails.name) parts.push(errorDetails.name);
  if (errorDetails.message) parts.push(errorDetails.message);
  if (errorDetails.statusCode !== undefined) parts.push(`status=${errorDetails.statusCode}`);

  const bodyDetails = parseProviderBody(errorDetails.body);
  const nested = errorDetails.error ?? bodyDetails;
  if (nested?.code !== undefined) {
    parts.push(`provider_code=${nested.code}`);
  }
  if (nested?.message && nested.message !== errorDetails.message) {
    parts.push(`provider_message=${nested.message}`);
  }

  const body = safeProviderBody(errorDetails.body);
  if (body) parts.push(`body=${body}`);

  if (errorDetails.headers instanceof Headers) {
    for (const name of DIAGNOSTIC_HEADER_NAMES) {
      const value = errorDetails.headers.get(name);
      if (value) parts.push(`${name}=${value}`);
    }
  }

  return parts.join(" | ") || "Unknown AI provider error";
}

/** Resolves the text model to use for chat completions, defaulting to DEFAULT_TEXT_MODEL. */
export function getConfiguredTextModel() {
  return process.env.NEWSBOY_AI_MODEL ?? DEFAULT_TEXT_MODEL;
}

export async function chatCompletion(options: ChatCompletionOptions = { messages: [] }) {
  const {
    apiKey,
    httpReferer,
    appTitle,
    appCategories,
    messages,
    model,
    maxTokens,
    temperature,
    responseFormat,
    tools,
    reasoningEffort,
  } = options;
  const client = createOpenRouterClient({ apiKey, httpReferer, appTitle, appCategories });
  const response = await client.chat.send({
    httpReferer,
    appTitle,
    appCategories,
    chatRequest: {
      model: model ?? getConfiguredTextModel(),
      stream: false,
      messages,
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(responseFormat !== undefined ? { responseFormat } : {}),
      ...(tools !== undefined ? { tools } : {}),
      ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
    },
  });

  // `stream: false` guarantees a completion response at runtime, but the SDK
  // exposes the stream union at the type level. Keep that boundary narrow so
  // callers do not have to repeat an impossible stream branch.
  return response as ChatCompletionResponse;
}

export async function generateEmbedding(content: string, options: EmbeddingOptions = {}) {
  const client = createOpenRouterClient(options);
  const response = await client.embeddings.generate({
    httpReferer: options.httpReferer,
    appTitle: options.appTitle,
    appCategories: options.appCategories,
    requestBody: {
      model: DEFAULT_EMBEDDING_MODEL,
      input: content,
      inputType: options.inputType ?? "search_document",
      dimensions: options.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
      encodingFormat: "float",
    },
  });

  const embeddingResponse = typeof response === "string" ? JSON.parse(response) : response;
  const embedding = embeddingResponse.data[0]?.embedding;

  return Array.isArray(embedding) ? embedding : [];
}
