


import type { Context } from "telegraf";
import agentService from "../services/agent.service";
import { UserService } from "../services/user.service";
import CryptoService  from "../services/crypto.service";

export class BotController {
  constructor(
    private readonly userService: UserService,
    private readonly cryptoService = CryptoService
  ) {}

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

  // TODO: Terminar de implementar
  async setapikey(ctx: Context) {
    try {

      // ====== Hardcoded for testing ======
      const userId = ctx.from?.id.toString() ?? "";
      const provider = "openai";
      const model = "1234";
      const apiKeyEncrypted = this.cryptoService.encrypt("MarceloMastroiani1234");
      // ===================================

      const result = await this.userService.createUser(userId, provider, model, apiKeyEncrypted)

      if (result !== void 0) {
        await ctx.reply(`API key set successfully`);
      } else {
        await ctx.reply(`API key already set`);
      }
    } catch {
      await ctx.reply(`Something went wrong`);
    }
  }

  async start(ctx: Context) {
    await ctx.reply(`Hello my name is Stoqra`);
  }

}
