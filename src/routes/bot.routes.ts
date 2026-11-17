import type { Bot } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";

import { BotController } from "../controllers/bot.controller";
import { UserService } from "../services/user.service";
import { AgentService } from "../services/agent.service";

import userRepository from "../repository/user.repository";
import cryptoService from "../services/crypto.service";

import type { BotContext } from "../bot/context";
import {
  createSetApiKeyConversation,
  SET_API_KEY_CONVERSATION,
} from "../bot/conversations/set-api-key.conversation";

// Raiz de composición de dependencias
export const setUpRoutes = (bot: Bot<BotContext>) => {
  const userService = new UserService(userRepository);
  const agentService = new AgentService(userService, cryptoService);
  const botController = new BotController(userService, cryptoService, agentService);

  // Las conversations se instalan antes de los handlers que las invocan.
  bot.use(conversations());
  bot.use(
    createConversation(
      createSetApiKeyConversation({ userService, cryptoService, agentService }),
      SET_API_KEY_CONVERSATION
    )
  );

  // "/start"
  bot.command("start", (ctx) => botController.start(ctx));

  // "/setapikey"
  bot.command("setapikey", (ctx) => ctx.conversation.enter(SET_API_KEY_CONVERSATION));

  // "/cancel" (mientras hay una conversación activa, lo maneja ella misma)
  bot.command("cancel", (ctx) => ctx.reply("No hay ninguna configuración en curso."));

  bot.on("message:text", (ctx) => botController.message(ctx));
  bot.on("message:document", (ctx) => botController.handleDocument(ctx));
};
