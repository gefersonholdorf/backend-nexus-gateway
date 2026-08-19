import { env } from "@/env";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

interface N8NGetAccessServerResponse {
	logins: number;
	failedLogins: number;
}

export const getAccessServerRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/servers/access",
		{
			schema: {
				body: z.object({
					server: z.string(),
				}),
			},
		},
		async (request, reply) => {
			const { server } = request.body;

			const response = await fetch(
				`${env.N8N_URL}/42a40192-431e-426d-8ff8-0046cc594cc9/`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						server,
					}),
				},
			);

			const data = (await response.json()) as N8NGetAccessServerResponse[];

			return reply.status(200).send({
				accessServer: data[0],
			});
		},
	);
};
