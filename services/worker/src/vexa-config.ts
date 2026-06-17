/**
 * Vexa connection config for the worker. The API key is read from env for now (bootstrap);
 * later it comes from the encrypted `vexa.api_key` setting. Base URL points at the Vexa gateway
 * (http://localhost:8056 in host-dev; http://vexa-gateway:8056 / a VPS host in compose).
 */
export interface VexaConfig {
  baseUrl: string;
  apiKey: string;
  botNameDefault: string;
}

export function vexaConfig(): VexaConfig {
  return {
    baseUrl: process.env.VEXA_BASE_URL ?? 'http://localhost:8056',
    apiKey: process.env.VEXA_API_KEY ?? '',
    botNameDefault: process.env.BOT_DISPLAY_NAME_DEFAULT ?? 'NoteTaker',
  };
}
