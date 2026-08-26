import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const fetchDocumentsRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/documents",
		{
			preHandler: [authenticate],
			schema: {
				title: "Fetch Documents",
				description: "Fetch Documents.",
				tags: ["Documents"],
				querystring: z.object({
					category: z.string().optional(),
					status: z
						.enum([
							"RASCUNHO",
							"EM_REVISAO",
							"EM_APROVACAO",
							"VIGENTE",
							"EXPIRADO",
							"CANCELADO",
						])
						.optional(),
					text: z.string().optional(),
					profile: z.string().optional(),
					page: z.coerce.number().default(1),
					perPage: z.coerce.number().default(10),
				}),
				response: {
					200: z.object({
						documents: z.array(
							z.object({
								id: z.number(),
								code: z.string(),
								category: z.string(),
								status: z.enum([
									"RASCUNHO",
									"EM_REVISAO",
									"EM_APROVACAO",
									"VIGENTE",
									"EXPIRADO",
									"CANCELADO",
								]),
								title: z.string(),
								version: z.string().nullable(),
								classification: z.string().nullable(),
								process: z.string().nullable(),
								isDocumentRevisionPending: z.boolean(),
								viewUrl: z.string().optional().nullable(),
								editUrl: z.string().optional().nullable(),
								profilesCount: z.number(),
								reviewId: z.number().nullable(),
								profiles: z.array(
									z.object({
										id: z.number(),
										name: z.string(),
										description: z.string().nullable(),
									}),
								),
								owner: z
									.object({
										id: z.number(),
										name: z.string(),
										avatarUrl: z.string().nullable(),
										roleDescription: z.string().nullable(),
									})
									.nullable(),
								nextReview: z.string().nullable(),
								createdAt: z.string(),
								updatedAt: z.string(),
							}),
						),
						pagination: z.object({
							page: z.number(),
							perPage: z.number(),
							total: z.number(),
							totalPages: z.number(),
							hasNextPage: z.boolean(),
							hasPreviousPage: z.boolean(),
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
			const { category, status, text, profile, page, perPage } = request.query;

			const where = {
				...(category && {
					ds_category: category,
				}),

				...(status && {
					ds_status: status,
				}),

				...(profile && {
					documents_roles: {
						some: {
							cd_role_id: Number(profile),
						},
					},
				}),

				...(text && {
					OR: [
						{
							ds_code: {
								contains: text,
							},
						},
						{
							ds_title: {
								contains: text,
							},
						},
					],
				}),
			};

			try {
				const [documents, total] = await Promise.all([
					prisma.documents.findMany({
						where,
						skip: (page - 1) * perPage,
						take: perPage,
						orderBy: {
							dt_updated_at: "desc",
						},
						include: {
							users_documents_cd_owner_user_idTousers: true,
							documents_roles: { include: { roles: true } },
							document_revisions: {
								where: { ds_status: "APROVADA" },
								orderBy: { cd_id: "desc" },
								take: 1,
								include: {
									document_versions: {
										orderBy: { cd_id: "desc" },
										take: 1,
									},
								},
							},
						},
					}),
					prisma.documents.count({
						where,
					}),
				]);

				const profilesCount = await prisma.roles.count();

				const documentsFormated = await Promise.all(
					documents.map(async (document) => {
						const lastRevision = document.document_revisions[0] ?? null;
						const lastVersion = lastRevision?.document_versions[0] ?? null;
						const version = lastVersion?.ds_version ?? null;

						const isDocumentRevisionPending =
							await prisma.document_revisions.findFirst({
								where: {
									cd_document_id: document.cd_id,
									ds_status: { in: ["ABERTA", "EM_APROVACAO"] },
								},
							});

						return {
							id: document.cd_id,
							code: document.ds_code,
							category: document.ds_category,
							status: document.ds_status,
							title: document.ds_title,
							classification: document.ds_classification ?? null,
							process: document.ds_process ?? null,
							createdAt: document.dt_created_at.toISOString(),
							updatedAt: document.dt_updated_at.toISOString(),
							nextReview: document.dt_next_review?.toISOString() ?? null,
							isDocumentRevisionPending: isDocumentRevisionPending
								? false
								: true,
							reviewId: isDocumentRevisionPending?.cd_id ?? null,
							version: version,
							profilesCount,
							profiles: document.documents_roles.map((dr) => ({
								id: dr.roles.cd_id,
								name: dr.roles.ds_name,
								description: dr.roles.ds_description,
							})),
							owner: document.users_documents_cd_owner_user_idTousers
								? {
										id: document.users_documents_cd_owner_user_idTousers.cd_id,
										name: document.users_documents_cd_owner_user_idTousers
											.ds_name,
										avatarUrl:
											document.users_documents_cd_owner_user_idTousers
												.ds_avatar_url,
										roleDescription:
											document.users_documents_cd_owner_user_idTousers
												?.ds_role_description,
									}
								: null,
						};
					}),
				);

				return reply.status(200).send({
					documents: documentsFormated,
					pagination: {
						page,
						perPage,
						total,
						totalPages: Math.ceil(total / perPage),
						hasNextPage: page < Math.ceil(total / perPage),
						hasPreviousPage: page > 1,
					},
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
