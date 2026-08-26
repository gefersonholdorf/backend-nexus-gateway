import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const createDocumentRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/documents",
		{
			preHandler: [authenticate, hasPermission("documents.create")],
			schema: {
				title: "Create Document",
				description: "Create a new Document ISO.",
				tags: ["Documents"],
				body: z.object({
					code: z.string().min(1, "Código obrigatório"),
					title: z.string().min(1, "Título obrigatório"),
					category: z.string().min(1, "Categoria obrigatória"),
					classification: z.string().min(1, "Classificação obrigatório"),
					editUrl: z.url("Url de edição é obrigatório"),
					process: z.string().min(1, "Área/Processo obrigatório"),
					ownerId: z.string().min(1, "Deve ser selecionado o responsável"),
					profiles: z
						.array(z.number())
						.min(1, "Selecione pelo menos um perfil"),
				}),
				response: {
					201: z.object({
						documentId: z.number(),
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
			const {
				category,
				profiles,
				title,
				code,
				classification,
				ownerId,
				process,
				editUrl,
			} = request.body;
			const { sub } = request.user;

			try {
				const document = await prisma.$transaction(async (tx) => {
					const document = await tx.documents.create({
						data: {
							ds_code: code.toUpperCase(),
							ds_category: category,
							ds_status: "RASCUNHO",
							ds_title: title.toUpperCase(),
							cd_create_user_id: Number(sub),
							cd_owner_user_id: Number(ownerId),
							ds_process: process,
							ds_classification: classification,
							nr_review_period_months: 12,
						},
					});

					await tx.documents_roles.createMany({
						data: profiles.map((profileId) => ({
							cd_document_id: document.cd_id,
							cd_role_id: profileId,
						})),
					});

					const dueDateRevision = new Date();
					dueDateRevision.setDate(dueDateRevision.getDate() + 15);

					const revision = await tx.document_revisions.create({
						data: {
							cd_document_id: document.cd_id,
							ds_reason: "Criação inicial do documento",
							dt_due_date: dueDateRevision,
							cd_open_user_id: Number(sub),
							ds_status: "ABERTA",
						},
					});

					const version = await tx.document_versions.create({
						data: {
							cd_document_id: document.cd_id,
							cd_revision_id: revision.cd_id,
							ds_version: "0.1",
							cd_create_user_id: Number(sub),
							ds_change_log: "Versão inicial do documento.",
							ds_status: "RASCUNHO",
							ds_edit_url: editUrl,
						},
					});

					await tx.documents.update({
						where: {
							cd_id: document.cd_id,
						},
						data: {
							cd_current_version_id: version.cd_id,
						},
					});

					return document;
				});

				return reply.status(201).send({
					documentId: document.cd_id,
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
