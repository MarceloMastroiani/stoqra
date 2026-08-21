import type { Context } from "telegraf";

class BotController {

  async message(ctx: Context) {
    try {
      if(!ctx.message || !("text" in ctx.message)) return;

      const message = ctx.message.text ?? "";

      if (!message.trim()) return;

      const { from } = ctx.message;

      await ctx.reply(`You said: ${message}`);

      if (from) {
        await ctx.reply(`Your username: ${from.username}`);
      }

    } catch {
      await ctx.reply(`Something went wrong`);
    }
  }

  async start(ctx: Context) {
    await ctx.reply(`Hello from ${ctx.from?.username ?? "you"}`);
  }
}

export default new BotController();
