import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const createVersionRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/documents/:documentId/versions",
		{
			preHandler: [authenticate],
			schema: {
				title: "Create version",
				description: "Create a new version",
				tags: ["Documents"],
				params: z.object({
					documentId: z.coerce.number(),
				}),
				body: z.object({
					editUrl: z.url().optional(),
					changeLog: z.string(),
					onwerId: z.number(),
				}),
				response: {
					201: z.object({
						versionId: z.number(),
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
			const { changeLog, editUrl } = request.body;
			const { documentId } = request.params;
			const { sub } = request.user;

			try {
				const revisionActive = await prisma.document_revisions.findFirst({
					where: {
						ds_status: { in: ["ABERTA", "EM_APROVACAO"] },
						cd_document_id: documentId,
					},
				});

				if (!revisionActive) {
					return reply.status(409).send({
						message:
							"Nenhuma revisão aberta, é necessário ter uma revisão aberta para criar uma versão.",
					});
				}

				if (revisionActive.ds_status === "EM_APROVACAO") {
					await prisma.document_revisions.update({
						where: {
							cd_id: revisionActive.cd_id,
						},
						data: {
							ds_status: "ABERTA",
						},
					});
				}

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

				const version = await prisma.document_versions.create({
					data: {
						ds_version: versionOld,
						nr_major: majorOld,
						nr_minor: minorOld,
						ds_change_log: changeLog,
						ds_status: "RASCUNHO",
						cd_document_id: documentId,
						cd_create_user_id: Number(sub),
						ds_edit_url: editUrl ?? null,
						cd_revision_id: revisionActive.cd_id,
						ds_view_url: null,
					},
				});

				return reply.status(201).send({
					versionId: version.cd_id,
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
