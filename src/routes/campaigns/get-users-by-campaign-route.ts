import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const UserAccessStats = z.object({
    dateView: z.string().nullable(),
    dateAccess: z.string().nullable(),
    status: z.enum(["Visualizou e acessou", "Visualizou, não acessou", "Não visualizou"])
})

export const CampaignUser = z.object({
    id: z.number(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    email: z.string(),
    stats: UserAccessStats
})

export const getUsersByCampaign = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get(
        "/campaigns/users/:idCampaign",
        {
            preHandler: [authenticate],
            schema: {
                title: "Get Users By Campaigns",
                description: "Get Users By Campaigns",
                tags: ["Campaigns"],
                params: z.object({
                    idCampaign: z.coerce.number()
                }),
                response: {
                    200: z.object({
                        users: z.array(CampaignUser),
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
            const { idCampaign } = request.params;

            try {
                const campaignUser = await prisma.campaign_user_access.findMany({
                    where: {
                        cd_campaign: Number(idCampaign)
                    },
                    include: {
                        users: true
                    }
                })

                if (!campaignUser) {
                    return reply.status(404).send({
                        message: "Campanha não encontrada."
                    })
                }

                const usersFormatted = campaignUser.map((item) => {
                    let status: "Visualizou e acessou" | "Visualizou, não acessou" | "Não visualizou" = "Não visualizou"

                    if(item.dt_first_seen) {
                        status = "Visualizou, não acessou"
                    }

                    if(item.dt_completed) {
                        status = "Visualizou e acessou"
                    }

                    return {
                        id: item.users.cd_id,
                        name: item.users.ds_name,
                        avatarUrl: item.users.ds_avatar_url,
                        email: item.users.ds_email,
                        stats: {
                            dateView: item.dt_first_seen?.toISOString() ?? null,
                            dateAccess: item.dt_completed?.toISOString() ?? null,
                            status
                        }
                    }
                })

                return reply.status(200).send({
                    users: usersFormatted
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
