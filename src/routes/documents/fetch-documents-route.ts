import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getDocumentsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get(
        "/documents",
        {
            preHandler: [authenticate],
            schema: {
                title: "Get Summary Document",
                description: "Get Summary a Document.",
                tags: ["Documents"],
                querystring: z.object({
                    category: z.string().optional(),
                    status: z.string().optional(),
                    text: z.string().optional(),
                    responsible: z.string().optional(),
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
                                responsible: z.string(),
                                status: z.string(),
                                title: z.string(),
                                url: z.string(),
                                updatedAt: z.string(),
                            })
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
                        message: z.string()
                    })
                },
            },
        },
        async (request, reply) => {
            const { category, responsible, status, text, page, perPage } = request.query;
            const { roles } = request.user

            const where = {
                ...(category && {
                    ds_category: category,
                }),

                ...(responsible && {
                    ds_responsible: responsible,
                }),

                ...(status && {
                    ds_status: status,
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
                    }),
                    prisma.documents.count({
                        where,
                    }),
                ]);

                const documentsFormated = documents.map((document) => {
                    return {
                        id: document.cd_id,
                        code: document.ds_code,
                        category: document.ds_category,
                        responsible: document.ds_responsible,
                        status: document.ds_status,
                        title: document.ds_title,
                        url: document.ds_url,
                        updatedAt: document.dt_updated_at.toISOString(),
                    }
                })

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
                console.error(error)
                return reply.status(500).send({
                    message: "Internal server error."
                })
            }
        },
    );
};
