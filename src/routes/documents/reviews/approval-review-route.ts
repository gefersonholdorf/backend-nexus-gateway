import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const approvalReviewRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/documents/revisions/approval/:reviewId",
		{
			preHandler: [authenticate],
			schema: {
				title: "Approval Review",
				description: "Approval a new Review",
				tags: ["Documents"],
				params: z.object({
					reviewId: z.coerce.number(),
				}),
				body: z.object({
					viewUrl: z.url(),
					reason: z.string(),
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
			const { reason, viewUrl } = request.body;

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
						ds_status: "APROVADA",
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
						ds_status: "APROVADA",
					},
				});

				const currentVersion = await prisma.document_versions.findFirst({
					where: {
						cd_revision_id: reviewId,
					},
					orderBy: {
						cd_id: "desc",
					},
				});

				const majorOld = currentVersion ? currentVersion.nr_major + 1 : 1;
				const minorOld = currentVersion ? 0 : 0;

				const versionOld = currentVersion ? `${majorOld}.${minorOld}` : "1.0";

				await prisma.document_versions.create({
					data: {
						ds_version: versionOld,
						nr_major: majorOld,
						nr_minor: minorOld,
						ds_change_log: reason,
						ds_status: "APROVADA",
						cd_document_id: currentRevision.cd_document_id,
						cd_create_user_id: Number(sub),
						cd_revision_id: currentRevision.cd_id,
						ds_edit_url: currentVersion?.ds_edit_url ?? null,
						ds_view_url: viewUrl,
					},
				});

				return reply.status(200).send({
					message: "Revisão aprovada com sucesso",
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
