import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const fetchReviewsRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/documents/reviews",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Summary Document",
				description: "Get Summary a Document.",
				tags: ["Documents"],
				querystring: z.object({
					type: z.enum(["assignedMe", "all", "applicantMe"]).optional(),
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
								applicant: z.string(),
								reviser: z.string().nullable(),
								status: z.string(),
								dueDate: z.string(),
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
			const { type, page, perPage } = request.query;

			const userId = request.user.sub;

			const where = {
				...(type === "assignedMe" && {
					cd_approved_user_id: Number(userId),
				}),

				...(type === "applicantMe" && {
					cd_request_user_id: Number(userId),
				}),
			};

			try {
				const [revisions, total] = await Promise.all([
					prisma.documents_revision_requests.findMany({
						where,
						skip: (page - 1) * perPage,
						take: perPage,
						orderBy: {
							dt_due_date: "desc",
						},
						include: {
							users: true,
							documents: {
								include: {
									users_documents_cd_owner_user_idTousers: true,
								},
							},
						},
					}),
					prisma.documents_revision_requests.count({
						where,
					}),
				]);

				const revisionsFormated = revisions.map((revision) => {
					return {
						id: revision.cd_id,
						document: {
							id: revision.documents.cd_id,
							title: revision.documents.ds_title,
						},
						applicant: revision.users.ds_name,
						reviser:
							revision.documents.users_documents_cd_owner_user_idTousers
								?.ds_name ?? null,
						status: revision.ds_status,
						dueDate: revision.dt_due_date.toISOString(),
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
