/** OpenRouter config for the worker. Bootstrap from env; later from the encrypted `ai.*` settings. */
export interface AiConfig {
  apiKey: string;
  model: string;
}

export function aiConfig(): AiConfig {
  return {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.OPENROUTER_DEFAULT_MODEL ?? 'anthropic/claude-haiku-4-5',
  };
}
