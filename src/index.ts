import fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { ipsRoute } from "./routes/ips-route";
import fastifyCors from "@fastify/cors";
import { getServersRoute } from "./routes/get-servers";
import { createUserRoute } from "./routes/create-user";
import { loginRoute } from "./routes/login";
import fastifyJwt from "@fastify/jwt";
import { env } from "./env";
import { getProblemsRoute } from "./routes/get-problems";
import { getProblemsTimelineRoute } from "./routes/get-problems-timeline";
import { getProblemsDetailsRoute } from "./routes/get-problems-details";

export const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifyCors, {
    origin: '*'
})

app.register(fastifyJwt, {
  secret: env.JWT_SECRET!,
})

app.register(ipsRoute)
app.register(getServersRoute)
app.register(createUserRoute)
app.register(loginRoute)
app.register(getProblemsRoute)
app.register(getProblemsTimelineRoute)
app.register(getProblemsDetailsRoute)