


import type { Telegraf } from "telegraf";
import { BotController } from "../controllers/bot.controller";
import { UserService } from "../services/user.service";
import userRepository from "../repository/user.repository";
import { message } from "telegraf/filters";


export class BotRouter {

  constructor(private readonly botController: BotController, bot: Telegraf) {
    this.setupRoutes(bot);
  }

  setupRoutes(bot: Telegraf) {
    // "/start"
    bot.start((ctx) => this.botController.start(ctx))

    // "/setapikey"
    bot.command("setapikey", (ctx) => this.botController.setapikey(ctx))

    bot.on(message("text"), (ctx) => this.botController.message(ctx))
  }
}

export const setUpRoutes = (bot: Telegraf) => {
  const userService = new UserService(userRepository);
  const botController = new BotController(userService);
  new BotRouter(botController, bot);
};
