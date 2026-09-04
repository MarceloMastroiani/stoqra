import 'dotenv/config'
import { z } from "zod";

const envsSchema = z.object({
  BOT_TOKEN: z.string(),
  OPENROUTER_API_KEY: z.string(),
});

const envsVars = envsSchema.parse(process.env);

export const envs = {
  botToken: envsVars.BOT_TOKEN,
  openRouterApiKey: envsVars.OPENROUTER_API_KEY,
}
