import { env } from "@/env";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify/types/instance";
import z from "zod";

interface N8NGetSummaryTicketsReponse {
	category: string;
	quantity: string;
}

export const getSummaryTicketsRoute = async (app: FastifyInstance) => {
	app.get(
		"/users/summary/tickets",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Summary Tickets",
				description: "View summary tickets by GLPI",
				tags: ["Users"],
				response: {
					200: z.object({
						summaryTickets: z.array(
							z.object({
								category: z.string(),
								quantity: z.number(),
							}),
						),
					}),
					404: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { idGLPI } = request.user;

			const response = await fetch(
				`${env.N8N_URL}/c049c335-5374-4bf8-ad02-2b55173bf6ef/`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						idGLPI,
					}),
				},
			);

			const data = (await response.json()) as N8NGetSummaryTicketsReponse[];

			console.log(data);

			if (data.length === 0) {
				return reply.status(404).send({
					message: "Tickets not found.",
				});
			}

			return reply.status(200).send({
				summaryTickets: data,
			});
		},
	);
};
