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

interface MicrosoftAzureCalendarReponse {
	value: MicrosoftGraphEvent[];
}

interface MicrosoftGraphEvent {
	id: string;
	iCalUId: string;

	subject: string;
	bodyPreview: string;

	isAllDay: boolean;
	isCancelled: boolean;

	start: {
		dateTime: string;
		timeZone: string;
	};

	end: {
		dateTime: string;
		timeZone: string;
	};

	organizer: {
		emailAddress: {
			name: string;
			address: string;
		};
	};

	attendees: {
		type: "required" | "optional";
		status: {
			response: "accepted" | "declined" | "tentative" | "none";
		};
		emailAddress: {
			name: string;
			address: string;
		};
	}[];

	isOnlineMeeting: boolean;
	onlineMeetingUrl: string | null;

	responseStatus: {
		response: "accepted" | "declined" | "tentative" | "notResponded";
	};

	webLink: string;

	location?: {
		displayName: string;
	};
}

export interface CalendarEvent {
	id: string;
	iCalUId: string;
	title: string;

	startAt: string;
	endAt: string;

	organizer: {
		name: string;
		email: string;
		logo?: string | null;
	};

	attendees: {
		name: string;
		email: string;
		logo?: string | null;
		response: string;
	}[];

	isOnline: boolean;
	location?: string;

	webLink: string;
}

export interface CalendarAttendee {
	name: string;
	email: string;

	type: "required" | "optional";

	response: "accepted" | "declined" | "tentative" | "none";
}

export const getNextEventsRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/calendar/nexts",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Next Events",
				description: "View calendar full",
				tags: ["Calendar"],
				querystring: z.object({
					startDate: z.string(),
					endDate: z.string(),
				}),
				response: {
					200: z.object({
						events: z.array(
							z.object({
								id: z.string(),
								iCalUId: z.string(),

								title: z.string(),

								startAt: z.string(),
								endAt: z.string(),

								organizer: z.object({
									name: z.string(),
									email: z.string(),
									logo: z.string().nullable().optional(),
								}),

								attendees: z.array(
									z.object({
										name: z.string(),
										email: z.string(),
										response: z.string(),
										logo: z.string().nullable().optional(),
									}),
								),

								isOnline: z.boolean(),

								location: z.string().optional(),

								webLink: z.string(),
							}),
						),
					}),
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
			const { startDate, endDate } = request.query;
			const { email } = request.user;

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

			if (!user) {
				return reply.status(404).send({
					message: "User not found.",
				});
			}

			const users = await prisma.users.findMany();

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${email}/calendar/calendarView?startDateTime=${startDate}&endDateTime=${endDate}`,
				{
					headers: {
						Authorization: loginData.access_token,
					},
				},
			);

			const calendars =
				(await response.json()) as MicrosoftAzureCalendarReponse;
			const events: CalendarEvent[] = calendars.value.map(
				(event): CalendarEvent => ({
					id: event.id,
					iCalUId: event.iCalUId,

					title: event.subject,

					startAt: event.start.dateTime,
					endAt: event.end.dateTime,

					organizer: {
						name: event.organizer.emailAddress.name,
						email: event.organizer.emailAddress.address,
						logo: users.find(
							(user) => user.ds_email === event.organizer.emailAddress.address,
						)
							? user.ds_avatar_url
							: "",
					},

					attendees: event.attendees.map((attendee) => {
						const existingUser = users.find(
							(u) => u.ds_email === attendee.emailAddress.address,
						);

						return {
							name: attendee.emailAddress.name,
							email: attendee.emailAddress.address,
							response:
								event.organizer.emailAddress.address ===
								attendee.emailAddress.address
									? "accepted"
									: attendee.status.response,
							logo: existingUser?.ds_avatar_url,
						};
					}),

					isOnline: event.isOnlineMeeting,

					location: event.location?.displayName,

					webLink: event.webLink,
				}),
			);

			const uniqueEvents = Array.from(
				new Map(events.map((event) => [event.iCalUId, event])).values(),
			);

			return reply.status(200).send({
				events: uniqueEvents,
			});
		},
	);
};
