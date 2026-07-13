import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const updateDocumentRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().put(
        "/documents/:id",
        {
            preHandler: [authenticate, hasPermission("documents.update")],
            schema: {
                title: "Update Document",
                description: "Update a new Document.",
                tags: ["Documents"],
                body: z.object({
                    code: z.string(),
                    title: z.string(),
                    category: z.string(),
                    status: z.string(),
                    viewUrl: z.url().nullable(),
                    editUrl: z.url().nullable(),
                    profiles: z.array(z.number())
                }),
                params: z.object({
                    id: z.coerce.number()
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                    }),
                    404: z.object({
                        message: z.string(),
                    }),
                    500: z.object({
                        message: z.string()
                    })
                },
            },
        },
        async (request, reply) => {
            const { category, status, title, viewUrl, editUrl, profiles, code } = request.body;
            const { id } = request.params

            try {
                await prisma.$transaction(async (tx) => {
                    await prisma.documents.update({
                        data: {
                            ds_code: code,
                            ds_category: category,
                            ds_status: status,
                            ds_title: title,
                            ds_edit_url: editUrl,
                            ds_view_url: viewUrl,
                        },
                        where: {
                            cd_id: id
                        }
                    })

                    await tx.documents_roles.deleteMany({
                        where: {
                            cd_document_id: id
                        }
                    });

                    await tx.documents_roles.createMany({
                        data: profiles.map((profileId) => ({
                            cd_document_id: id,
                            cd_role_id: profileId,
                        })),
                    });
                });

                return reply.status(200).send({
                    message: "Document successfully updated"
                });
            } catch (error) {
                console.error(error)
                return reply.status(500).send({
                    message: "Internal server error."
                })
            }
        },
    );
};
