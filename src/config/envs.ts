import 'dotenv/config'
import { z } from "zod";

const envsSchema = z.object({
  BOT_TOKEN: z.string(),
  MASTER_KEY: z.string()
});

const envsVars = envsSchema.parse(process.env);

export const envs = {
  botToken: envsVars.BOT_TOKEN,
  masterKey: envsVars.MASTER_KEY,
}
