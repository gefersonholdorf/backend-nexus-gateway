import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getProfilesSelect = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get('/profiles/select', {
        preHandler: [authenticate],
        schema: {
            title: "Get Profiles Select",
            description: "Get Profiles Select",
            tags: ["Profiles"],
            response: {
                200: z.object({
                    profiles: z.array(z.object({
                        id: z.number(),
                        name: z.string(),
                        description: z.string().nullable()
                    }))
                }),
                500: z.object({
                    message: z.string()
                })
            },
        }
    }, async (_, reply) => {
        try {
            const profiles = await prisma.roles.findMany({
                select: {
                    cd_id: true,
                    ds_name: true,
                    ds_description: true
                }
            })

            return reply.status(200).send({
                profiles: profiles.map(profile => ({
                    id: profile.cd_id,
                    name: profile.ds_name,
                    description: profile.ds_description
                }))
            })

        } catch (error) {
            console.error(error)
            reply.status(500).send({
                message: 'Internal server error'
            })
        }
    })
}