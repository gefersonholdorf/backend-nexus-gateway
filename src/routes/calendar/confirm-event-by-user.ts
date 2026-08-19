import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { authenticate } from "@/middlewares/authenticate";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { FastifyInstance } from "fastify/types/instance";
import z from "zod";

interface MicrosoftAzureLoginReponse {
	token_type: string;
	expires_in: number;
	ext_expires_in: number;
	access_token: string;
}

export const confirmEventByUserRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/calendar/confirm",
		{
			preHandler: [authenticate],
			schema: {
				title: "Confirm Event By User",
				description: "View calendar full",
				tags: ["Calendar"],
				body: z.object({
					comment: z.string(),
					sendResponse: z.boolean(),
					eventId: z.string(),
				}),
				response: {
					200: z.object({}),
					404: z.object({
						message: z.string(),
					}),
					500: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { email } = request.user;

			const { comment, sendResponse, eventId } = request.body;

			const params = new URLSearchParams();

			params.append("client_id", env.AZURE_CLIENT_ID);
			params.append("client_secret", env.AZURE_CLIENT_SECRET);
			params.append("grant_type", "client_credentials");
			params.append("scope", "https://graph.microsoft.com/.default");

			const loginResponse = await fetch(
				`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: params,
				},
			);

			const loginData =
				(await loginResponse.json()) as MicrosoftAzureLoginReponse;

			if (!loginData.access_token) {
				return reply.status(500).send({
					message: "Failed to generate Microsoft token.",
				});
			}

			const user = await prisma.users.findUnique({
				where: {
					ds_email: email,
				},
			});

			const users = await prisma.users.findMany();

			if (!user) {
				return reply.status(404).send({
					message: "User not found.",
				});
			}

			try {
				const response = await fetch(
					`https://graph.microsoft.com/v1.0/users/${email}/events/${eventId}/accept`,
					{
						method: "POST",
						headers: {
							Authorization: loginData.access_token,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							sendResponse,
							comment,
						}),
					},
				);

				return reply.status(200).send({});
			} catch (error) {
				console.log(error);

				return reply.status(500).send({
					message: "Internal server error",
				});
			}
		},
	);
};
