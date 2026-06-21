import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { authenticate } from "@/middlewares/authenticate";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { FastifyInstance } from "fastify/types/instance";
import { userInfo } from "node:os";
import z from "zod";

const getDurationMinutes = (start: string, end: string) => {
	return (new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60;
};

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
	};

	attendees: {
		name: string;
		email: string;
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

export const getEventsSummaryRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/calendar/summary",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Events Summary",
				description: "View calendar full",
				tags: ["Calendar"],
				response: {
					200: z.object({
						summary: z.object({
							meetingsToday: z.number(),
							scheduledHoursToday: z.number(),
							freeHoursToday: z.number(),
							productivityPercentage: z.number(),
							onlineMeetings: z.number(),
							presencialMeetings: z.number(),
							acceptedMeetings: z.number(),
							tentativeMeetings: z.number(),
							declinedMeetings: z.number(),
							canceledMeetings: z.number(),
							nextMeetingAt: z.string().nullable(),
							averageMeetingMinutes: z.number(),
							uniqueAttendees: z.number(),
							status: z.string(),
						}),
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

			const existingUser = await prisma.users.findUnique({
				where: {
					ds_email: email,
				},
			});

			if (!existingUser) {
				return reply.status(404).send({
					message: "User not found.",
				});
			}

			const now = new Date("2026-06-11");

			const startDate = new Date(now);
			startDate.setHours(0, 0, 0, 0);

			const endDate = new Date(now);
			endDate.setHours(23, 59, 59, 999);

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${email}/calendar/calendarView?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}`,
				{
					headers: {
						Authorization: loginData.access_token,
					},
				},
			);

			const { value: events } =
				(await response.json()) as MicrosoftAzureCalendarReponse;
			const meetingsToday = events.length;

			const onlineMeetings = events.filter(
				(event) => event.isOnlineMeeting,
			).length;

			const acceptedMeetings = events.filter(
				(event) => event.responseStatus.response === "accepted",
			).length;

			const tentativeMeetings = events.filter(
				(event) => event.responseStatus.response === "tentative",
			).length;

			const declinedMeetings = events.filter(
				(event) => event.responseStatus.response === "declined",
			).length;

			const canceledMeetings = events.filter(
				(event) => event.isCancelled,
			).length;

			const totalMinutes = events.reduce((total, event) => {
				return (
					total + getDurationMinutes(event.start.dateTime, event.end.dateTime)
				);
			}, 0);

			const scheduledHoursToday = Number((totalMinutes / 60).toFixed(1));

			const WORK_HOURS = 10;

			const freeHoursToday = Number(
				Math.max(0, WORK_HOURS - scheduledHoursToday).toFixed(1),
			);

			const productivityPercentage = Math.round(
				(scheduledHoursToday / WORK_HOURS) * 100,
			);

			const nextMeeting = events
				.filter((event) => new Date(event.start.dateTime) > new Date())
				.sort(
					(a, b) =>
						new Date(a.start.dateTime).getTime() -
						new Date(b.start.dateTime).getTime(),
				)[0];

			const nextMeetingAt = nextMeeting?.start.dateTime ?? null;

			const averageMeetingMinutes =
				meetingsToday > 0 ? Math.round(totalMinutes / meetingsToday) : 0;

			const uniqueAttendees = new Set(
				events.flatMap((event) =>
					event.attendees.map((attendee) => attendee.emailAddress.address),
				),
			).size;

			const presencialMeetings = meetingsToday - onlineMeetings;

			const status = nextMeeting ? "busy" : "available";

			const summary = {
				meetingsToday,

				scheduledHoursToday,

				freeHoursToday,

				productivityPercentage,

				onlineMeetings,

				presencialMeetings,

				acceptedMeetings,

				tentativeMeetings,

				declinedMeetings,

				canceledMeetings,

				nextMeetingAt,

				averageMeetingMinutes,

				uniqueAttendees,

				status,
			};

			return reply.status(200).send({
				summary,
			});
		},
	);
};
