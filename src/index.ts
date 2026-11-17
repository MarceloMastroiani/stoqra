import { Bot } from "grammy";

import { envs } from "./config/envs";
import { setUpRoutes } from "./routes/bot.routes";
import type { BotContext } from "./bot/context";

const bot = new Bot<BotContext>(envs.botToken);

setUpRoutes(bot);

bot.catch((err) => {
  console.error(err.error);
  void err.ctx.reply("Oops, something went wrong.");
});

void bot.start({
  onStart: (me) => console.log(`Bot @${me.username} is running...`),
});

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
