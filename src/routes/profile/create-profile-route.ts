import { prisma } from "@/db/prisma";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";

export const createProfileRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/profiles",
        {
            preHandler: [authenticate, hasPermission("profiles.create")],
            schema: {
                title: "Create Profile",
                description: "Create a new profile.",
                tags: ["Profiles"],
                body: z.object({
                    title: z.string(),
                    description: z.string().nullable(),
                    status: z.boolean(),
                    permissions: z.array(z.object({
                        id: z.number()
                    }))
                }),
                response: {
                    201: z.object({
                        profileId: z.number(),
                    }),
                    404: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { title, description, status, permissions } = request.body;

            const profile = await prisma.$transaction(async (tx) => {
                const profile = await tx.roles.create({
                    data: {
                        ds_name: title,
                        ds_description: description,
                        st_status: status ? 1 : 0
                    },
                });

                await tx.role_permissions.createMany({
                    data: permissions.map((permission) => ({
                        cd_role: profile.cd_id,
                        cd_permission: permission.id,
                    })),
                });

                return profile
            });

            return reply.status(201).send({
                profileId: profile.cd_id,
            });
        },
    );
};
