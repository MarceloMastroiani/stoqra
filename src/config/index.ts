import type { ChatOpenRouterInput } from "@langchain/openrouter";
import { envs } from "./envs";

class ModelConfig implements ChatOpenRouterInput {
  private _model: string;
  private _temperature: number;
  private _maxTokens: number;
  private _apiKey: string;

  constructor(model: string, temperature: number, maxTokens: number, apiKey: string) {
    this._model = model;
    this._temperature = temperature;
    this._maxTokens = maxTokens;
    this._apiKey = apiKey;
  }

  get model() {
    return this._model;
  }

  get temperature() {
    return this._temperature;
  }

  get maxTokens() {
    return this._maxTokens;
  }

  get apiKey() {
    return this._apiKey;
  }
}


export const modelConfig = new ModelConfig(
  "deepseek/deepseek-v4-flash-0731",
  0,
  1024,
  envs.openRouterApiKey,
);
