import type { Telegraf } from "telegraf";
import botController from "../controllers/bot.controller";
import { message } from "telegraf/filters";


export const setUpRoutes = (bot: Telegraf) => {
  // "/start"
  bot.start((ctx) => botController.start(ctx))

  bot.on(message("text"), (ctx) => botController.message(ctx))
};
