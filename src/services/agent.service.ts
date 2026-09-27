import { createAgent } from "langchain";
import { ChatOpenRouter } from "@langchain/openrouter";
//import { MemorySaver } from "@langchain/langgraph";
import databaseService from "../db/database";
import { BunSqliteSaver } from "../db/checkpointer";

import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  PROVIDER_BASE_URLS,
  type Provider,
} from "../config";
import type { UserRecord } from "../db/database";
import type { UserService } from "./user.service";
import type { CryptoService } from "./crypto.service";

type Agent = ReturnType<typeof createAgent>;

export class AgentService {
  // Caché de agentes por usuario. Las credenciales vienen de la base de datos,
  // por lo que sobreviven reinicios del servidor.
  private readonly agents = new Map<string, Agent>();
  private readonly checkpointer = new BunSqliteSaver(databaseService.getRawDb());

  // Compartido entre todos los agentes para conservar la memoria de cada
  // conversación (thread_id) aunque se reconstruya el agente del usuario.
  // private readonly checkpointer = new MemorySaver();

  constructor(
    private readonly userService: UserService,
    private readonly cryptoService: CryptoService

  ) {}

  async getResponse(message: string, sessionId: string, userId: string): Promise<string> {
    try {
      const user = await this.userService.getUser(userId);

      if (!user) {
        return "⚠️ Todavía no configuraste tu API key. Usá /setapikey para agregarla.";
      }

      if (!(user.provider in PROVIDER_BASE_URLS)) {
        return `El proveedor "${user.provider}" no está soportado. Volvé a configurarlo con /setapikey.`;
      }

      const agent = this.getOrCreateAgent(userId, user);

      const config = {
        configurable: {
          thread_id: sessionId,
        },
      };

      const result = await agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
        },
        config
      );

      const lastMessage = result.messages[result.messages.length - 1];

      if (lastMessage && "content" in lastMessage) {

        return lastMessage.content as string;
      }

      return "No response from agent";
    } catch (error) {
      console.error("Error in agent service:", error);
      return "No pude procesar tu mensaje. Verificá tu API key con /setapikey.";
    }
  }

  // Se llama después de guardar una API key nueva para no usar la vieja.
  invalidateUser(userId: string): void {
    this.agents.delete(userId);
  }

  private getOrCreateAgent(userId: string, user: UserRecord): Agent {
    const cached = this.agents.get(userId);

    if (cached) return cached;

    const agent = this.buildAgent(user);
    this.agents.set(userId, agent);

    return agent;
  }

  private buildAgent(user: UserRecord): Agent {
    const apiKey = this.cryptoService.decrypt(user.api_key_encrypted);
    const baseURL = PROVIDER_BASE_URLS[user.provider as Provider];

    const model = new ChatOpenRouter({
      model: user.model ?? DEFAULT_MODEL,
      apiKey,
      baseURL,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
      siteName: "Stoqra",
    });

    return createAgent({
      model,
      tools: [],
      checkpointer: this.checkpointer,
      systemPrompt: "You are a helpful assistant.",
    });
  }
}
