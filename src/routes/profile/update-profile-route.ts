import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const updateProfileRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().put(
        "/profiles/:id",
        {
            preHandler: [authenticate, hasPermission("profiles.update")],
            schema: {
                title: "Update Profile",
                description: "update a new profile.",
                tags: ["Profiles"],
                body: z.object({
                    title: z.string(),
                    description: z.string().nullable(),
                    status: z.boolean(),
                    permissions: z.array(z.object({
                        id: z.number()
                    }))
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
                },
            },
        },
        async (request, reply) => {
            const { title, description, status, permissions } = request.body;
            const { id } = request.params

            const profile = await prisma.$transaction(async (tx) => {
                const profile = await tx.roles.update({
                    where: {
                        cd_id: id,
                    },
                    data: {
                        ds_name: title,
                        ds_description: description,
                        st_status: status ? 1 : 0,
                    },
                });

                await tx.role_permissions.deleteMany({
                    where: {
                        cd_role: profile.cd_id,
                    },
                });

                if (permissions.length > 0) {
                    await tx.role_permissions.createMany({
                        data: [...new Set(permissions)].map((permission) => ({
                            cd_role: profile.cd_id,
                            cd_permission: permission.id,
                        })),
                    });
                }

                return profile;
            });

            return reply.status(200).send({
                message: 'Perfil atualizado com sucesso'
            });
        },
    );
};
