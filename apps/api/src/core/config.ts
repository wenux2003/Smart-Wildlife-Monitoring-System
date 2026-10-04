import { z } from "zod";

const ConfigSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_HOST: z.string().default("0.0.0.0"),
});

export const config = ConfigSchema.parse(process.env);
