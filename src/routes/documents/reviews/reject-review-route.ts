import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const rejectReviewRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/documents/revisions/reject/:reviewId",
		{
			preHandler: [authenticate],
			schema: {
				title: "Reject Review",
				description: "Reject a new Review",
				tags: ["Documents"],
				params: z.object({
					reviewId: z.coerce.number(),
				}),
				response: {
					200: z.object({
						message: z.string(),
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
			const { reviewId } = request.params;
			const { sub } = request.user;

			try {
				const currentRevision = await prisma.document_revisions.findUnique({
					where: {
						cd_id: reviewId,
					},
				});

				if (!currentRevision) {
					return reply.status(404).send({
						message: "Revisão não encontrada.",
					});
				}

				await prisma.document_revisions.update({
					where: {
						cd_id: reviewId,
					},
					data: {
						ds_status: "CANCELADA",
						dt_approved_at: new Date(),
						dt_completed_at: new Date(),
						cd_approved_user_id: Number(sub),
					},
				});

				await prisma.document_versions.updateMany({
					where: {
						cd_revision_id: reviewId,
					},
					data: {
						ds_status: "CANCELADA",
					},
				});

				return reply.status(200).send({
					message: "Revisão cancelada com sucesso",
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
