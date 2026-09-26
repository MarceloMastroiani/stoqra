export const PROVIDERS = ["openai", "anthropic", "openrouter", "google", "groq", "deepseek"] as const;

export type Provider = (typeof PROVIDERS)[number];

// ChatOpenRouter permite apuntar a cualquier endpoint compatible con OpenAI
// pasándole baseURL. Cada proveedor usa su propia URL.
export const PROVIDER_BASE_URLS: Record<Provider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1/",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
};

export const DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731";
export const DEFAULT_TEMPERATURE = 0;
export const DEFAULT_MAX_TOKENS = 1024;
