import z from "zod";
import "dotenv/config";

const envSchema = z.object({
	PORT: z.coerce.number().default(3333),
	APP: z.enum(["development", "production"]).default("development"),
	PORTAINER_TOKEN: z.string(),
	PORTAINER_URL: z.url(),
	ZABBIX_URL: z.url(),
	ZABBIX_USERNAME: z.string(),
	ZABBIX_PASSWORD: z.string(),
	N8N_URL: z.url(),
	DATABASE_URL: z.url(),
	DATABASE_HOST: z.string(),
	DATABASE_PORT: z.coerce.number(),
	DATABASE_USER: z.string(),
	DATABASE_PASSWORD: z.string(),
	DATABASE_NAME: z.string(),
	JWT_SECRET: z.string(),
	AZURE_TENANT_ID: z.string(),
	AZURE_CLIENT_ID: z.string(),
	AZURE_CLIENT_SECRET: z.string(),
	TOKEN_JIRA: z.string(),
	NAS_URL: z.url(),
	NAS_LOGIN: z.string(),
	NAS_PASSWORD: z.string(),
});

export const env = envSchema.parse(process.env);
