import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const fetchReviewsRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/documents/revisions",
		{
			preHandler: [authenticate],
			schema: {
				title: "Fetch Reviews Document",
				description: "Fetch Reviews Document",
				tags: ["Documents"],
				querystring: z.object({
					documentId: z.coerce.number().optional(),
					page: z.coerce.number().default(1),
					perPage: z.coerce.number().default(10),
				}),
				response: {
					200: z.object({
						revisions: z.array(
							z.object({
								id: z.number(),
								document: z.object({
									id: z.number(),
									title: z.string(),
								}),
								autoOpened: z.boolean(),
								reason: z.string(),
								description: z.string().nullable(),
								openUser: z.object({
									id: z.number(),
									name: z.string(),
									avatarUrl: z.string().nullable(),
									roleDescription: z.string().nullable(),
								}),
								reviserUser: z
									.object({
										id: z.number(),
										name: z.string(),
										avatarUrl: z.string().nullable(),
										roleDescription: z.string().nullable(),
									})
									.nullable(),
								status: z.enum([
									"ABERTA",
									"EM_APROVACAO",
									"APROVADA",
									"CANCELADA",
								]),
								dueDate: z.string().nullable(),
								completedAt: z.string().nullable(),
								approvedAt: z.string().nullable(),
								versions: z.array(
									z.object({
										id: z.number(),
										version: z.string(),
										changeLog: z.string().nullable(),
										status: z.enum([
											"RASCUNHO",
											"EM_APROVACAO",
											"APROVADA",
											"CANCELADA",
										]),
										createUser: z.object({
											id: z.number(),
											name: z.string(),
											avatarUrl: z.string().nullable(),
											roleDescription: z.string().nullable(),
										}),
									}),
								),
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
			const { page, perPage, documentId } = request.query;

			const where = {
				...(documentId && {
					cd_document_id: documentId,
				}),
			};

			try {
				const [revisions, total] = await Promise.all([
					prisma.document_revisions.findMany({
						where,
						skip: (page - 1) * perPage,
						take: perPage,
						orderBy: {
							dt_due_date: "desc",
						},
						include: {
							users_document_revisions_cd_open_user_idTousers: true,
							documents: {
								include: {
									users_documents_cd_owner_user_idTousers: true,
								},
							},
							document_versions: {
								include: {
									users: true,
								},
							},
						},
					}),
					prisma.document_revisions.count({
						where,
					}),
				]);

				const revisionsFormated = revisions.map((revision) => {
					const versionFormatted = revision.document_versions.map((version) => {
						return {
							id: version.cd_id,
							version: version.ds_version,
							changeLog: version.ds_change_log ?? null,
							status: version.ds_status,
							createUser: {
								id: version.users.cd_id,
								name: version.users.ds_name,
								avatarUrl: version.users.ds_avatar_url ?? null,
								roleDescription: version.users.ds_role_description ?? null,
							},
						};
					});

					return {
						id: revision.cd_id,
						document: {
							id: revision.documents.cd_id,
							title: revision.documents.ds_title,
						},
						autoOpened: revision.fl_auto_opened,
						reason: revision.ds_reason,
						description: revision.ds_description ?? null,
						openUser: {
							id: revision.users_document_revisions_cd_open_user_idTousers
								.cd_id,
							name: revision.users_document_revisions_cd_open_user_idTousers
								.ds_name,
							avatarUrl:
								revision.users_document_revisions_cd_open_user_idTousers
									.ds_avatar_url ?? null,
							roleDescription:
								revision.users_document_revisions_cd_open_user_idTousers
									.ds_role_description ?? null,
						},
						reviserUser: revision.documents
							.users_documents_cd_owner_user_idTousers
							? {
									id: revision.documents.users_documents_cd_owner_user_idTousers
										.cd_id,
									name: revision.documents
										.users_documents_cd_owner_user_idTousers.ds_name,
									avatarUrl:
										revision.documents.users_documents_cd_owner_user_idTousers
											.ds_avatar_url ?? null,
									roleDescription:
										revision.documents.users_documents_cd_owner_user_idTousers
											.ds_role_description ?? null,
								}
							: null,
						status: revision.ds_status,
						dueDate: revision.dt_due_date
							? revision.dt_due_date.toISOString()
							: null,
						completedAt: revision.dt_completed_at
							? revision.dt_completed_at.toISOString()
							: null,
						approvedAt: revision.dt_approved_at
							? revision.dt_approved_at.toISOString()
							: null,
						versions: versionFormatted,
					};
				});

				return reply.status(200).send({
					revisions: revisionsFormated,
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
