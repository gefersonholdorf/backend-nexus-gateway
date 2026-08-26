import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const createReviewRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/documents/:documentId/revisions",
		{
			preHandler: [authenticate],
			schema: {
				title: "Create Review",
				description: "Create a new Review",
				tags: ["Documents"],
				params: z.object({
					documentId: z.coerce.number(),
				}),
				body: z.object({
					reason: z.string(),
					description: z.string(),
				}),
				response: {
					201: z.object({
						reviewId: z.number(),
					}),
					409: z.object({
						message: z.string(),
					}),
					500: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { description, reason } = request.body;
			const { documentId } = request.params;
			const { sub } = request.user;

			try {
				const thereIsAReviewProcess = await prisma.document_revisions.count({
					where: {
						cd_document_id: documentId,
					},
				});

				const revisionActive = await prisma.document_revisions.findFirst({
					where: {
						ds_status: { in: ["APROVADA", "CANCELADA"] },
						cd_document_id: documentId,
					},
				});

				if (!revisionActive && thereIsAReviewProcess > 0) {
					return reply.status(409).send({
						message:
							"Já existe uma revisão aberta, favor finalizar essa revisão primeiro para depois cadastrar uma nova.",
					});
				}
				const dueDateRevision = new Date();
				dueDateRevision.setDate(dueDateRevision.getDate() + 15);

				const review = await prisma.document_revisions.create({
					data: {
						cd_document_id: documentId,
						ds_reason: reason ?? "",
						ds_description: description ?? "",
						dt_due_date: dueDateRevision,
						cd_open_user_id: Number(sub),
						ds_status: "ABERTA",
					},
				});

				const currentVersion = await prisma.document_versions.findFirst({
					where: {
						cd_document_id: documentId,
					},
					orderBy: {
						cd_id: "desc",
					},
				});

				const majorOld = currentVersion ? currentVersion.nr_major : 1;
				const minorOld = currentVersion ? currentVersion.nr_minor + 1 : 0;

				const versionOld = currentVersion ? `${majorOld}.${minorOld}` : "1.0";

				await prisma.document_versions.create({
					data: {
						ds_version: versionOld,
						nr_major: majorOld,
						nr_minor: minorOld,
						ds_change_log: `Versão criada a partir da revisão #${review.cd_id}`,
						ds_status: "RASCUNHO",
						cd_document_id: documentId,
						cd_create_user_id: Number(sub),
						cd_revision_id: review.cd_id,
						ds_view_url: null,
						ds_edit_url: null,
					},
				});

				await prisma.documents.update({
					where: {
						cd_id: documentId,
					},
					data: {
						ds_status: "EM_REVISAO",
					},
				});

				return reply.status(201).send({
					reviewId: review.cd_id,
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
