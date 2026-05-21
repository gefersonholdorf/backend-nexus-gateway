import z from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().default(3333),
    PORTAINER_TOKEN: z.string(),
    PORTAINER_URL: z.url()
})

export const env = envSchema.parse(process.env)