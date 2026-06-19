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

interface MicrosoftAzureAvailabilitynReponse {
	value: {
		scheduleId: string;
		availabilityView: string;
	}[];
}

interface MicrosoftAzureavailAbilityReponse {}

export const getCalendarRoute = async (app: FastifyInstance) => {
	app.get(
		"/calendar/availability",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Availability User",
				description: "View availability a user",
				tags: ["Calendar"],
				response: {
					200: z.object({
						availabilitys: z.array(
							z.object({
								name: z.string(),
								logo: z.string().nullable(),
								scheduleId: z.string(),
								availabilityView: z.string(),
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

			const emails = users.map((user) => user.ds_email);

			const now = new Date();
			const end = new Date(now.getTime() + 5 * 60 * 1000);

			const availabilityResponse = await fetch(
				`https://graph.microsoft.com/v1.0/users/suporte@lusati.com.br/calendar/getSchedule`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: loginData.access_token,
					},
					body: JSON.stringify({
						schedules: emails,
						startTime: {
							dateTime: now.toISOString(),
							timeZone: "E. South America Standard Time",
						},
						endTime: {
							dateTime: end.toISOString(),
							timeZone: "E. South America Standard Time",
						},
						availabilityViewInterval: 5,
					}),
				},
			);

			const availabilityData =
				(await availabilityResponse.json()) as MicrosoftAzureAvailabilitynReponse;

			const availabilitys = availabilityData.value.map((item) => {
				const user = users.find((user) => user.ds_email === item.scheduleId);

				if (!user) {
					return;
				}

				return {
					name: user.ds_name,
					logo: user.ds_avatar_url,
					scheduleId: item.scheduleId,
					availabilityView: item.availabilityView,
				};
			});

			return reply.status(200).send({
				availabilitys,
			});
		},
	);
};
