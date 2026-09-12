


import type { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

import { BotController } from "../controllers/bot.controller";
import { UserService } from "../services/user.service";

import userRepository from "../repository/user.repository";
import cryptoService from "../services/crypto.service";


export class BotRouter {

  constructor(private readonly botController: BotController, bot: Telegraf) {
    this.setupRoutes(bot);
  }

  setupRoutes(bot: Telegraf) {
    // "/start"
    bot.start((ctx) => this.botController.start(ctx))

    // "/setapikey"
    bot.command("setapikey", (ctx) => this.botController.setapikey(ctx))

    // "/cancel"
    bot.command("cancel", (ctx) => this.botController.cancel(ctx))

    bot.on(message("text"), (ctx) => this.botController.message(ctx))
  }
}

// Raiz de composición de dependencias
export const setUpRoutes = (bot: Telegraf) => {
  const userService = new UserService(userRepository);
  const botController = new BotController(userService, cryptoService);
  new BotRouter(botController, bot);
};
