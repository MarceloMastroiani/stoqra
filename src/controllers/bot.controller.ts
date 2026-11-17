import type { Context, Filter } from "grammy";

import type { AgentService } from "../services/agent.service";
import { UserService } from "../services/user.service";
import { CryptoService } from "../services/crypto.service";

type TextContext = Filter<Context, "message:text">;
type DocumentContext = Filter<Context, "message:document">;

export class BotController {
  constructor(
    private readonly userService: UserService,
    private readonly cryptoService: CryptoService,
    private readonly agentService: AgentService
  ) {}

  async handleDocument(ctx: DocumentContext) {
    try {
      return ctx.reply(ctx.message.document.file_name ?? "No file name");
    } catch (error) {
      console.log(error);
    }
  }

  async message(ctx: TextContext) {
    try {
      const message = ctx.message.text;
      if (!message.trim()) return;

      const userId = ctx.from?.id.toString() ?? "";
      const chatId = ctx.chat?.id.toString() ?? "";
      const sessionId = `${userId}-${chatId}`;

      const response = await this.agentService.getResponse(message, sessionId, userId);
      await ctx.reply(response);
    } catch {
      await ctx.reply("Something went wrong");
    }
  }

  async start(ctx: Context) {
    await ctx.reply("Hola, soy Stoqra. Usá /setapikey para configurar tu proveedor de IA.");
  }
}
