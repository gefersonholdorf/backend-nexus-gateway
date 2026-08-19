import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify/types/instance";
import z from "zod";

interface MicrosoftAzureLoginReponse {
	token_type: string;
	expires_in: number;
	ext_expires_in: number;
	access_token: string;
}

interface MicrosoftAzurePresenceUserReponse {
	id: string;
	availability: string;
	activity: string;
	sequenceNumber: string;
	statusMessage: string | null;
	workLocation: string | null;
	outOfOfficeSettings: {
		message: string | null;
		isOutOfOffice: boolean;
	};
}

interface MicrosoftAzureavailAbilityReponse {}

export const getPresenceUserRoute = async (app: FastifyInstance) => {
	app.get(
		"/calendar/presence",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Availability User",
				description: "View availability a user",
				tags: ["Calendar"],
				response: {
					200: z.object({
						users: z.array(
							z.object({
								id: z.number(),
								name: z.string(),
								email: z.string(),
								roleDescription: z.string(),
								logo: z.string().nullable(),
								availability: z.string(),
								activity: z.string(),
							}),
						),
					}),
					500: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
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

			const users = await prisma.users.findMany();

			const presences = await Promise.all(
				users.map(async (user) => {
					const response = await fetch(
						`https://graph.microsoft.com/v1.0/users/${user.cd_id_microsoft}/presence`,
						{
							method: "GET",
							headers: {
								Authorization: `Bearer ${loginData.access_token}`,
							},
						},
					);

					const presence =
						(await response.json()) as MicrosoftAzurePresenceUserReponse;

					return {
						id: user.cd_id,
						name: user.ds_name,
						email: user.ds_email,
						roleDescription: user.ds_role_description,
						logo: user.ds_avatar_url,
						availability: presence.availability,
						activity: presence.activity,
					};
				}),
			);

			return reply.status(200).send({
				users: presences,
			});
		},
	);
};
