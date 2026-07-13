import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const deleteDocumentRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().delete(
        "/documents/:id",
        {
            preHandler: [authenticate, hasPermission("documents.delete")],
            schema: {
                title: "Delete Document",
                description: "Delete a new Document.",
                tags: ["Documents"],
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
            const { id } = request.params

            try {
                await prisma.$transaction([
                    prisma.documents_roles.deleteMany({
                        where: {
                            cd_document_id: id,
                        },
                    }),
                    prisma.documents.delete({
                        where: {
                            cd_id: id,
                        },
                    }),
                ]);

                return reply.status(200).send({
                    message: "Document successfully deleted"
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
