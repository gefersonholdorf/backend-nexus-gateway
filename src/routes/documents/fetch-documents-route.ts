import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
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
                                status: z.string(),
                                title: z.string(),
                                viewUrl: z.string().optional().nullable(),
                                editUrl: z.string().optional().nullable(),
                                profiles: z.array(z.object({
                                    id: z.number(),
                                    name: z.string(),
                                    description: z.string().nullable()
                                })),
                                createdAt: z.string(),
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
                            documents_roles: {
                                include: {
                                    roles: true
                                }
                            }
                        }
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
                        status: document.ds_status,
                        title: document.ds_title,
                        viewUrl: document.ds_view_url,
                        editUrl: document.ds_edit_url,
                        createdAt: document.dt_created_at.toISOString(),
                        updatedAt: document.dt_updated_at.toISOString(),
                        profiles: document.documents_roles.map((dr) => ({
                            id: dr.roles.cd_id,
                            name: dr.roles.ds_name,
                            description: dr.roles.ds_description,
                        })),
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
