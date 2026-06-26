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
                    responsible: z.string(),
                    url: z.url()
                }),
                params:z.object({
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
            const { category, responsible, status, title, url, code } = request.body;
            const { id } = request.params

            try {
                await prisma.documents.update({
                    data: {
                        ds_code: code,
                        ds_category: category,
                        ds_responsible: responsible,
                        ds_status: status,
                        ds_title: title,
                        ds_url: url,
                        dt_updated_at: new Date()
                    },
                    where: {
                        cd_id: id
                    }
                })

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
