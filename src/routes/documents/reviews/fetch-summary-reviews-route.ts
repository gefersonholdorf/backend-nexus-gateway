import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const fetchSummaryReviewsRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/documents/revisions/summary",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Summary Document",
				description: "Get Summary a Document.",
				tags: ["Documents"],
				querystring: z.object({
					documentId: z.coerce.number().optional(),
				}),
				response: {
					200: z.object({
						summary: z.object({
							total: z.number(),
							open: z.number(),
							pendingApproval: z.number(),
							approved: z.number(),
							cancelled: z.number(),
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
			const { documentId } = request.query;

			const where = {
				...(documentId && {
					cd_document_id: documentId,
				}),
			};

			try {
				const [revisions, total] = await Promise.all([
					prisma.document_revisions.findMany({
						where,
					}),
					prisma.document_revisions.count({
						where,
					}),
				]);

				const summary = {
					total,
					open: revisions.filter((item) => item.ds_status === "ABERTA").length,
					pendingApproval: revisions.filter(
						(item) => item.ds_status === "EM_APROVACAO",
					).length,
					approved: revisions.filter((item) => item.ds_status === "APROVADA")
						.length,
					cancelled: revisions.filter((item) => item.ds_status === "CANCELADA")
						.length,
				};

				return reply.status(200).send({
					summary,
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
