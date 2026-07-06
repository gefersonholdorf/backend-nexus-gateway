import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getPermissionsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/profiles/permissions", {
        preHandler: [authenticate],
        schema: {
            title: "Get Permissions",
            description: "Get Permissions",
            tags: ["Profiles"],
            response: {
                200: z.object({
                    permissions: z.array(z.object({
                        id: z.number(),
                        key: z.string(),
                        description: z.string().nullable()
                    })),
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

        try {
            const permissions = await prisma.permissions.findMany()

            const permissionsFormated = permissions.map((permission) => {
                return {
                    id: permission.cd_id,
                    key: permission.ds_key,
                    description: permission.ds_description
                }
            })

            return reply.status(200).send({
                permissions: permissionsFormated
            })

        } catch (error) {
            return reply.status(500).send({
                message: "Internal server error."
            })
        }
    })
}