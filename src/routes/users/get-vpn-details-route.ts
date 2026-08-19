import { env } from "@/env";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify/types/instance";
import z from "zod";

interface N8NGetVPNDetailsReponse {
	name: string;
	expirationRaw: string;
	expirationDate: string;
	daysRemaining: number;
	status: "valid" | "critical" | "warning" | "expired";
}

export const getVPNDetailsRoute = async (app: FastifyInstance) => {
	app.get(
		"/users/vpn",
		{
			preHandler: [authenticate],
			schema: {
				title: "VPN Details",
				description: "View user's VPN details",
				tags: ["Users"],
				response: {
					200: z.object({
						vpnDetails: z.object({
							name: z.string(),
							expirationRaw: z.string(),
							expirationDate: z.string(),
							daysRemaining: z.number(),
							status: z.enum(["valid", "critical", "warning", "expired"]),
						}),
					}),
					404: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { vpnName } = request.user;

			const response = await fetch(
				`${env.N8N_URL}/fff8b924-74fe-490e-a1a1-5e307ccba142/`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						vpnName,
					}),
				},
			);

			const data = (await response.json()) as N8NGetVPNDetailsReponse[];

			if (data.length === 0) {
				return reply.status(404).send({
					message: "VPN not found.",
				});
			}

			return reply.status(200).send({
				vpnDetails: data[0],
			});
		},
	);
};
