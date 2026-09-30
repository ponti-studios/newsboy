import { OpenRouter } from "@openrouter/sdk";

export type OpenRouterClientOptions = {
  apiKey?: string;
  httpReferer?: string;
  appTitle?: string;
  appCategories?: string;
};

export type ChatCompletionResponse = Extract<
  Awaited<ReturnType<OpenRouter["chat"]["send"]>>,
  { object: "chat.completion" }
>;

function resolveOpenRouterApiKey(apiKey?: string) {
  const resolvedApiKey = apiKey ?? process.env.OPENROUTER_API_KEY;

  if (!resolvedApiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  return resolvedApiKey;
}

export function createOpenRouterClient(options: OpenRouterClientOptions = {}) {
  return new OpenRouter({
    apiKey: resolveOpenRouterApiKey(options.apiKey),
    httpReferer: options.httpReferer,
    appTitle: options.appTitle,
    appCategories: options.appCategories,
  });
}
