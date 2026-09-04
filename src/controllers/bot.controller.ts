


import type { Context } from "telegraf";
import agentService from "../services/agent.service";

class BotController {

  async message(ctx: Context) {
    try {
      if(!ctx.message || !("text" in ctx.message)) return;

      const message = ctx.message.text ?? "";

      if (!message.trim()) return;


      const userId = ctx.from?.id.toString() ?? "";
      const chatId = ctx.chat?.id.toString() ?? "";
      const sessionId = `${userId}-${chatId}`;

      const response = await agentService.getResponse(message, sessionId)

      await ctx.reply(response);
    } catch {
      await ctx.reply(`Something went wrong`);
    }
  }

  async start(ctx: Context) {
    await ctx.reply(`Hello my name is Stoqra`);
  }
}

export default new BotController();
