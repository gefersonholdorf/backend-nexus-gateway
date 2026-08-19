import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getProfileByIdRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/profiles/:id", {
        preHandler: [authenticate],
        schema: {
            title: "Get Profile bt Id",
            description: "Get Profile bt Id",
            tags: ["Profiles"],
            params: z.object({
                id: z.coerce.number()
            }),
            response: {
                200: z.object({
                    profile: z.object({
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
                    })
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
        const { id } = request.params

        try {
            const profile = await prisma.roles.findUnique({
                include: {
                    role_permissions: {
                        include: {
                            permissions: true,
                        },
                    },
                    user_roles: true,
                },
                where: {
                    cd_id: id
                }
            })

            if (!profile) {
                return reply.status(404).send({
                    message: "Profile not found."
                })
            }

            const countPermissions = await prisma.permissions.count()

            const profileFormated = {
                id: profile.cd_id,
                title: profile.ds_name,
                description: profile.ds_description,
                createdAt: profile.dt_created_at.toISOString(),
                status: profile.st_status === 1,
                countUsers: profile.user_roles.length,
                countTotalPermissions: countPermissions,
                permissions: profile.role_permissions.map((permission) => {
                    return {
                        id: permission.permissions.cd_id,
                        key: permission.permissions.ds_key,
                        description: permission.permissions.ds_description
                    }
                })
            }

            return reply.status(200).send({
                profile: profileFormated,
            })
        } catch (error) {
            return reply.status(500).send({
                message: "Internal server error."
            })
        }
    })
}