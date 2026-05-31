import z from "zod";
import "dotenv/config";

const envSchema = z.object({
    PORT: z.coerce.number().default(3333),
    PORTAINER_TOKEN: z.string(),
    PORTAINER_URL: z.url(),
    ZABBIX_URL: z.url(),
    ZABBIX_USERNAME: z.string(),
    ZABBIX_PASSWORD: z.string(),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string()
})

export const env = envSchema.parse(process.env)