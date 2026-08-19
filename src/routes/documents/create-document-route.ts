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
                    code: z.string(),
                    title: z.string(),
                    category: z.string(),
                    status: z.string(),
                    viewUrl: z.url().nullable(),
                    editUrl: z.url().nullable(),
                    profiles: z.array(z.number())
                }),
                response: {
                    201: z.object({
                        documentId: z.number(),
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
            const { category, profiles, status, title, editUrl, viewUrl, code } = request.body;
            const { sub } = request.user

            try {
                const document = await prisma.$transaction(async (tx) => {
                    const document = await tx.documents.create({
                        data: {
                            ds_code: code,
                            ds_category: category,
                            ds_status: status,
                            ds_title: title,
                            ds_edit_url: editUrl,
                            ds_view_url: viewUrl,
                            cd_create_user_id: Number(sub),
                        },
                    });

                    await tx.documents_roles.createMany({
                        data: profiles.map((profileId) => ({
                            cd_document_id: document.cd_id,
                            cd_role_id: profileId,
                        })),
                    });

                    return document;
                });

                return reply.status(201).send({
                    documentId: document.cd_id,
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
