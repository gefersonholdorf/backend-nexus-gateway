import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const createDocumentEventRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/documents/:id/event",
		{
			preHandler: [authenticate],
			schema: {
				title: "Create Document Event",
				description: "Create a new Document Event ISO.",
				tags: ["Documents"],
				params: z.object({
					id: z.coerce.number(),
				}),
				response: {
					201: z.object({
						documentEventId: z.number(),
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
			const { id } = request.params;
			const { sub } = request.user;

			const ip =
				request.headers["x-forwarded-for"]?.toString().split(",")[0] ??
				request.headers["x-real-ip"]?.toString() ??
				request.ip;

			try {
				const documentEvent = await prisma.documents_events.create({
					data: {
						cd_document_id: id,
						cd_user_id: Number(sub),
						ds_ip: ip,
						ds_user_agent: request.headers["user-agent"] || null,
					},
				});

				return reply.status(201).send({
					documentEventId: documentEvent.cd_id,
				});
			} catch (error) {
				console.error(error);
				return reply.status(500).send({
					message: "Internal server error.",
				});
			}
		},
	);
};
