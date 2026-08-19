import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const deleteCampaignRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().delete(
        "/campaigns/:idCampaign",
        {
            preHandler: [authenticate],
            schema: {
                title: "Delete Campaign",
                description: "Delete a new Campaign.",
                tags: ["Campaigns"],
                params: z.object({
                    idCampaign: z.coerce.number()
                }),
                response: {
                    200: z.void(),
                    400: z.object({
                        message: z.string()
                    }),
                    404: z.object({
                        message: z.string()
                    }),
                    409: z.object({
                        message: z.string()
                    }),
                    500: z.object({
                        message: z.string()
                    })
                },
            },
        },
        async (request, reply) => {
            const { idCampaign } = request.params

            try {
                await prisma.$transaction(async (tx) => {

                    const existingCampaign = await tx.campaigns.findUnique({
                        where: {
                            cd_campaign: idCampaign,
                        }
                    });

                    if (!existingCampaign) {
                        return reply.status(404).send({
                            message: "Campanha não encontrada."
                        })
                    }

                    await prisma.campaign_user_access.deleteMany({
                        where: {
                            cd_campaign: idCampaign
                        }
                    })

                    await prisma.campaigns.delete({
                        where: {
                            cd_campaign: idCampaign
                        }
                    })
                });

                return reply.status(200).send();
            } catch (error) {
                console.error(error)
                return reply.status(500).send({
                    message: "Internal server error."
                })
            }
        },
    );
};
