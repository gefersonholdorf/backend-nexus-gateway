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
                description: "Create a new Document.",
                tags: ["Documents"],
                body: z.object({
                    code: z.string(),
                    title: z.string(),
                    category: z.string(),
                    status: z.string(),
                    responsible: z.string(),
                    url: z.url()
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
            const { category, responsible, status, title, url, code } = request.body;

            try {
                const document = await prisma.documents.create({
                    data: {
                        ds_code: code,
                        ds_category: category,
                        ds_responsible: responsible,
                        ds_status: status,
                        ds_title: title,
                        ds_url: url,
                        dt_updated_at: new Date()
                    }
                })

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
