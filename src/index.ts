import { Telegraf } from "telegraf";
import { envs } from "./config/envs";
import { setUpRoutes } from "./routes/bot.routes";

const telegramBotToken = envs.botToken

if (!telegramBotToken) {
  throw new Error("BOT_TOKEN is not defined");
}

const bot = new Telegraf(telegramBotToken);

setUpRoutes(bot);

bot.catch((err, ctx) => {
  console.error(err);
  void ctx.reply("Oops, something went wrong.");
});

function main() {
  try {

    void bot.launch();

    process.once("SIGINT", () => {
      bot.stop("SIGINT");
    });
    process.once("SIGTERM", () => {
      bot.stop("SIGTERM");
    });

    console.log("Bot is running...");

  } catch (err) {
    console.error("Error starting bot:", err);
    process.exit(1);
  }
}
void main();
