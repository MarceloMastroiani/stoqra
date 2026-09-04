import type { ChatOpenRouterInput } from "@langchain/openrouter";
import { envs } from "./envs";

export const modelConfig: ChatOpenRouterInput = {
  model: "deepseek/deepseek-v4-flash-0731",
  temperature: 0,
  maxTokens: 1024,
  apiKey: envs.openRouterApiKey,
};
