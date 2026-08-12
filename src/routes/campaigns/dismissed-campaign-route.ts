import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const dismissedCampaignRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/campaigns/:campaignId/access/dismissed",
        {
            preHandler: [authenticate],
            schema: {
                title: "Dismissed Campaign",
                description: "Dismissed Campaign.",
                tags: ["Campaigns"],
                params: z.object({
                    campaignId: z.coerce.number()
                }),
                response: {
                    204: z.void(),
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
            const { sub } = request.user
            const { campaignId } = request.params

            try {
                const campaignUser = await prisma.campaign_user_access.findFirst({
                    where: {
                        cd_user: Number(sub),
                        cd_campaign: Number(campaignId)
                    }
                })

                if (!campaignUser) {
                    return reply.status(404).send({
                        message: "Registro não encontrado."
                    })
                }

                if (!campaignUser.dt_dismissed) {
                    await prisma.campaign_user_access.update({
                        data: {
                            dt_dismissed: new Date(),
                        },
                        where: {
                            cd_campaign_user_access:
                                campaignUser.cd_campaign_user_access
                        }
                    })
                }

                return reply.status(204).send();
            } catch (error) {
                console.error(error)
                return reply.status(500).send({
                    message: "Internal server error."
                })
            }
        },
    );
};
