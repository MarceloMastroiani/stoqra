import type { Context } from "telegraf";

import { PROVIDERS, type Provider } from "../config";
import type { AgentService } from "../services/agent.service";
import { UserService } from "../services/user.service";
import { CryptoService } from "../services/crypto.service";

type ApiKeySession =
  | { step: "waiting-provider" }
  | { step: "waiting-model"; provider: Provider }
  | { step: "waiting-api-key"; provider: Provider; model: string };

export class BotController {
  private readonly apiKeySessions = new Map<string, ApiKeySession>();

  constructor(
    private readonly userService: UserService,
    private readonly cryptoService: CryptoService,
    private readonly agentService: AgentService
  ) {}

  async handleDocument(ctx: Context) {
    try {
      if (!ctx.message || !("document" in ctx.message)) return;

      return ctx.reply(ctx.message.document.file_name ?? "No file name")

    } catch (error) {
      console.log(error)
    }
  }

  async message(ctx: Context) {
    try {
      if (!ctx.message || !("text" in ctx.message)) return;

      const message = ctx.message.text ?? "";
      if (!message.trim()) return;

      const userId = ctx.from?.id.toString() ?? "";
      const chatId = ctx.chat?.id.toString() ?? "";
      const sessionId = `${userId}-${chatId}`;

      const session = this.apiKeySessions.get(sessionId);

      if (session?.step === "waiting-provider") {
        await this.handleProvider(ctx, message, sessionId);
        return;
      }

      if (session?.step === "waiting-model") {
        await this.handleModel(ctx, message, sessionId);
        return;
      }

      if (session?.step === "waiting-api-key") {
        await this.handleApiKey(ctx, message, sessionId);
        return;
      }

      const response = await this.agentService.getResponse(message, sessionId, userId);
      await ctx.reply(response);
    } catch {
      await ctx.reply("Something went wrong");
    }
  }

  async setapikey(ctx: Context) {
    try {
      const userId = ctx.from?.id.toString() ?? "";
      const chatId = ctx.chat?.id.toString() ?? "";
      const sessionId = `${userId}-${chatId}`;

      const existing = await this.userService.getUser(userId);
      if (existing) {
        await ctx.reply(
          "Ya tenés una API key configurada. Vamos a reemplazarla. Usá /cancel para cancelar."
        );
      }

      this.apiKeySessions.set(sessionId, { step: "waiting-provider" });

      // Formateamos la lista de proveedores con viñetas
      const providerList = PROVIDERS.map((p) => `  • ${p}`).join("\n");
      await ctx.reply(
        `¿Qué proveedor de IA usás?\n\nOpciones:\n${providerList}\n\nEscribí el nombre exacto del proveedor.`
      );
    } catch (error) {
      console.error(error);
      await ctx.reply("Something went wrong");
    }
  }

  async cancel(ctx: Context) {
    const userId = ctx.from?.id.toString() ?? "";
    const chatId = ctx.chat?.id.toString() ?? "";
    const sessionId = `${userId}-${chatId}`;

    if (this.apiKeySessions.has(sessionId)) {
      this.apiKeySessions.delete(sessionId);
      await ctx.reply("Configuración cancelada.");
    }
  }

  // Maneja la selección del proveedor
  private async handleProvider(ctx: Context, message: string, sessionId: string) {
    const input = message.trim().toLowerCase() as Provider;

    if (!PROVIDERS.includes(input)) {
      const providerList = PROVIDERS.map((p) => `  • ${p}`).join("\n");
      await ctx.reply(
        `Proveedor no reconocido.\n\nOpciones:\n${providerList}\n\nEscribí el nombre exacto.`
      );
      return;
    }

    this.apiKeySessions.set(sessionId, { step: "waiting-model", provider: input });

    const modelExample = input === "openrouter" ? "deepseek/deepseek-chat" : "gpt-4o";
    await ctx.reply(
      `Proveedor: ${input}\n\n¿Qué modelo usás? (ej: ${modelExample})`
    );
  }

  private async handleModel(ctx: Context, message: string, sessionId: string) {
    const model = message.trim();

    if (!model) {
      await ctx.reply("El modelo no puede estar vacío. Escribí el nombre del modelo.");
      return;
    }

    const session = this.apiKeySessions.get(sessionId);
    if (!session || session.step !== "waiting-model") return;

    this.apiKeySessions.set(sessionId, { step: "waiting-api-key", provider: session.provider, model });
    await ctx.reply(`Modelo: ${model}\n\nIngresá tu API key de ${session.provider}:`);
  }

  private async handleApiKey(ctx: Context, apiKey: string, sessionId: string) {
    try {
      if (!apiKey.trim()) {
        await ctx.reply("La API Key no puede estar vacía. Escribila o /cancel para cancelar.");
        return;
      }

      const session = this.apiKeySessions.get(sessionId);
      if (!session || session.step !== "waiting-api-key") return;

      const userId = ctx.from?.id.toString() ?? "";
      const { provider, model } = session;

      const apiKeyEncrypted = this.cryptoService.encrypt(apiKey);
      await this.userService.createUser(userId, provider, model, apiKeyEncrypted);

      // Descartamos el agente cacheado para que use la key nueva
      this.agentService.invalidateUser(userId);

      this.apiKeySessions.delete(sessionId);

      await ctx.reply(
        `✅ Configuración guardada.\n\nProveedor: ${provider}\nModelo: ${model}\nAPI Key: configurada`
      );
    } catch (error) {
      console.error(error);
      await ctx.reply("Something went wrong");
    }
  }

  async start(ctx: Context) {
    await ctx.reply("Hola, soy Stoqra. Usá /setapikey para configurar tu proveedor de IA.");
  }
}
