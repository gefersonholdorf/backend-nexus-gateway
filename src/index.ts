import fastify from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
	jsonSchemaTransform,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { env } from "./env";
import fastifySwagger from "@fastify/swagger";
import fastifyScalar from "@scalar/fastify-api-reference";
import { routes } from "./routes";

export const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifySwagger, {
	openapi: {
		info: {
			title: "DeployerX API",
			version: "1.0.0",
		},
		servers: [
			{
				url: `http://localhost:3336`,
				description: "Development server",
			},
			{
				url: `http://10.188.15.99:3336`,
				description: "Production server",
			},
		],
		components: {
			securitySchemes: {
				ApiKeyAuth: {
					type: "apiKey",
					name: "Authorization",
					in: "header",
				},
			},
		},
	},
	transform: jsonSchemaTransform,
});

app.register(fastifyScalar, {
	routePrefix: "/docs",
	logLevel: "silent",
	configuration: {
		theme: "kepler",
	},
});

app.register(fastifyCors, {
  origin: "http://localhost:5173",
  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
});

app.register(fastifyJwt, {
	secret: env.JWT_SECRET,
});

app.register(routes, { prefix: "api/v1" });

app.get("/status", (_, reply) => {
	return reply.status(200).send({
		status: "UP",
	});
});
