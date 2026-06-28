import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const fetchProfilesRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/profiles", {
        preHandler: [authenticate],
        schema: {
            title: "Get Profiles",
            description: "Get Profiles",
            tags: ["Profiles"],
            querystring: z.object({
                status: z.string().optional(),
                title: z.string().optional(),
                page: z.coerce.number().default(1),
                perPage: z.coerce.number().default(10),
            }),
            response: {
                200: z.object({
                    profiles: z.array(z.object({
                        id: z.number(),
                        title: z.string(),
                        description: z.string().nullable(),
                        createdAt: z.string(),
                        status: z.boolean(),
                        countUsers: z.number(),
                        countTotalPermissions: z.number(),
                        permissions: z.array(z.object({
                            id: z.number(),
                            key: z.string(),
                            description: z.string().nullable()
                        }))
                    })),
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
        }
    }, async (request, reply) => {
        const { page, perPage, status, title } = request.query

        const where = {
            ...(status && {
                st_status: status === 'Ativo' ? 1 : 0,
            }),

            ...(title && {
                OR: [
                    {
                        ds_name: {
                            contains: title,
                        },
                    },
                ],
            }),
        };

        try {
            const [profiles, total] = await Promise.all([
                prisma.roles.findMany({
                    include: {
                        role_permissions: {
                            include: {
                                permissions: true,
                            },
                        },
                        user_roles: true,
                    },
                    where,
                    skip: (page - 1) * perPage,
                    take: perPage,
                    orderBy: {
                        dt_created_at: "desc",
                    },
                }),
                prisma.roles.count({
                    where,
                }),
            ])

            const countPermissions = await prisma.permissions.count()

            const profilesFormated = profiles.map((profile) => {
                const permissions = profile.role_permissions.map((permission) => {
                    return {
                        id: permission.permissions.cd_id,
                        key: permission.permissions.ds_key,
                        description: permission.permissions.ds_description
                    }
                })
                return {
                    id: profile.cd_id,
                    title: profile.ds_name,
                    description: profile.ds_description ?? null,
                    createdAt: profile.dt_created_at.toISOString(),
                    status: profile.st_status === 1,
                    countUsers: profile.user_roles.length,
                    countTotalPermissions: countPermissions,
                    permissions
                }
            })

            return reply.status(200).send({
                profiles: profilesFormated,
                pagination: {
                    page,
                    perPage,
                    total,
                    totalPages: Math.ceil(total / perPage),
                    hasNextPage: page < Math.ceil(total / perPage),
                    hasPreviousPage: page > 1,
                },
            })
        } catch (error) {
            return reply.status(500).send({
                message: "Internal server error."
            })
        }
    })
}