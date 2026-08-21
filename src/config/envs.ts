import 'dotenv/config'
import { z } from "zod";

const envsSchema = z.object({
  BOT_TOKEN: z.string(),
});

const envsVars = envsSchema.parse(process.env);

export const envs = {
  botToken: envsVars.BOT_TOKEN,
}
