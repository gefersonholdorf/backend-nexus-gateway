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
		scheduleItems: {
			isPrivate: false;
			status: string;
			subject: string;
			location: string;
			isMeeting: boolean;
			isRecurring: boolean;
			isException: boolean;
			isReminderSet: boolean;
			start: {
				dateTime: string;
				timeZone: string;
			};
			end: {
				dateTime: string;
				timeZone: string;
			};
		};
	}[];
}

interface MicrosoftAzureavailAbilityReponse {}

export const getAvailabilityUserRoute = async (app: FastifyInstance) => {
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
								scheduleItems: z.array(
									z.object({
										status: z.string(),
										isPrivate: z.boolean().optional(),
										subject: z.string().optional(),
										location: z.string().optional(),
										isMeeting: z.boolean().optional(),
										isRecurring: z.boolean().optional(),
										isException: z.boolean().optional(),
										isReminderSet: z.boolean().optional(),
										start: z.object({
											dateTime: z.string(),
											timeZone: z.string(),
										}),
										end: z.object({
											dateTime: z.string(),
											timeZone: z.string(),
										}),
									}),
								),
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

			const today = new Date();

			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, "0");
			const day = String(today.getDate()).padStart(2, "0");

			const startDateTime = `${year}-${month}-${day}T08:00:00`;
			const endDateTime = `${year}-${month}-${day}T18:00:00`;

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
							dateTime: startDateTime,
							timeZone: "E. South America Standard Time",
						},
						endTime: {
							dateTime: endDateTime,
							timeZone: "E. South America Standard Time",
						},
						availabilityViewInterval: 30,
					}),
				},
			);

			const availabilityData =
				(await availabilityResponse.json()) as MicrosoftAzureAvailabilitynReponse;

			const availabilitys = availabilityData.value
				.map((item) => {
					const user = users.find((user) => user.ds_email === item.scheduleId);

					if (!user) {
						return null;
					}

					return {
						name: user.ds_name,
						logo: user.ds_avatar_url,
						scheduleId: item.scheduleId,
						availabilityView: item.availabilityView,
						scheduleItems: item.scheduleItems,
					};
				})
				.filter(Boolean);

			return reply.status(200).send({
				availabilitys,
			});
		},
	);
};
