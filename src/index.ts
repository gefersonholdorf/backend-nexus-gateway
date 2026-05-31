import fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { ipsRoute } from "./routes/ips-route";
import fastifyCors from "@fastify/cors";
import { getServersRoute } from "./routes/get-servers";

export const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifyCors, {
    origin: '*'
})

app.register(ipsRoute)
app.register(getServersRoute)