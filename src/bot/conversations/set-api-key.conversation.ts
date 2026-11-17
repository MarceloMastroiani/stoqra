import { InlineKeyboard } from "grammy";
import type { Conversation } from "@grammyjs/conversations";

import { PROVIDERS, type Provider } from "../../config";
import type { AgentService } from "../../services/agent.service";
import type { CryptoService } from "../../services/crypto.service";
import type { UserService } from "../../services/user.service";
import type { BotContext, ConversationContext } from "../context";

const PROVIDER_CALLBACK_PREFIX = "provider:";

export const SET_API_KEY_CONVERSATION = "setApiKey";

type SetApiKeyDeps = {
  userService: UserService;
  cryptoService: CryptoService;
  agentService: AgentService;
};

function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function createSetApiKeyConversation(deps: SetApiKeyDeps) {
  return async function setApiKey(
    conversation: Conversation<BotContext, ConversationContext>,
    ctx: ConversationContext
  ): Promise<void> {
    const userId = ctx.from?.id.toString() ?? "";

    // Lectura de base de datos: siempre dentro de conversation.external porque
    // la conversación se re-ejecuta desde el inicio en cada update.
    const existing = await conversation.external(() => deps.userService.getUser(userId));
    if (existing) {
      await ctx.reply(
        "Ya tenés una API key configurada. Vamos a reemplazarla. Usá /cancel para cancelar."
      );
    }

    // Permite salir del flujo en cualquier paso con /cancel.
    void conversation.waitForCommand("cancel").then(async (cancelCtx) => {
      await cancelCtx.reply("Configuración cancelada.");
      await conversation.halt();
    });

    const keyboard = new InlineKeyboard();
    PROVIDERS.forEach((provider, index) => {
      keyboard.text(provider, `${PROVIDER_CALLBACK_PREFIX}${provider}`);
      if (index % 2 === 1) keyboard.row();
    });

    await ctx.reply("Selecciona tu proveedor de IA", { reply_markup: keyboard });

    const providerCtx = await conversation.waitForCallbackQuery(
      new RegExp(`^${PROVIDER_CALLBACK_PREFIX}.+$`)
    );
    await providerCtx.answerCallbackQuery();

    const provider = providerCtx.callbackQuery.data.slice(PROVIDER_CALLBACK_PREFIX.length);
    if (!isProvider(provider)) {
      await providerCtx.reply("Proveedor no reconocido. Volvé a empezar con /setapikey.");
      return;
    }

    const modelExample = provider === "openrouter" ? "deepseek/deepseek-chat" : "gpt-4o";
    await providerCtx.editMessageText(
      `Proveedor: ${provider}\n\n¿Qué modelo usás? (ej: ${modelExample})`
    );

    let modelCtx = await conversation.waitFor("message:text");
    while (!modelCtx.message.text.trim()) {
      await modelCtx.reply("El modelo no puede estar vacío. Escribí el nombre del modelo.");
      modelCtx = await conversation.waitFor("message:text");
    }
    const model = modelCtx.message.text.trim();

    await modelCtx.reply(`Modelo: ${model}\n\nIngresá tu API key de ${provider}:`);

    let keyCtx = await conversation.waitFor("message:text");
    while (!keyCtx.message.text.trim()) {
      await keyCtx.reply(
        "La API Key no puede estar vacía. Escribila o /cancel para cancelar."
      );
      keyCtx = await conversation.waitFor("message:text");
    }
    const apiKey = keyCtx.message.text.trim();

    // No dejamos la API key visible en el chat.
    await keyCtx.deleteMessage().catch(() => {});

    const apiKeyEncrypted = await conversation.external(() =>
      deps.cryptoService.encrypt(apiKey)
    );
    await conversation.external(() =>
      deps.userService.createUser(userId, provider, model, apiKeyEncrypted)
    );

    // Descartamos el agente cacheado para que use la key nueva.
    await conversation.external(() => {
      deps.agentService.invalidateUser(userId);
    });

    await keyCtx.reply(
      `✅ Configuración guardada.\n\nProveedor: ${provider}\nModelo: ${model}\nAPI Key: configurada`
    );
  };
}
