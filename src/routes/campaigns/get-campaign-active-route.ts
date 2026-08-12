import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const CampaignUser = z.object({
    id: z.number(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    email: z.string()
})

export const CampaignAccessStats = z.object({
    total: z.number(),
    accessed: z.number(),
    viewed: z.number(),
    pending: z.number(),
    ignored: z.number().optional(),
    accessRate: z.number().optional(),
})

export const CampaignStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'INACTIVE'])
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>

export const Campaign = z.object({
    id: z.number(),
    code: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    monthYear: z.string(),
    publishDate: z.string().nullable(),
    status: CampaignStatusSchema,
    url: z.string().nullable(),
    accessStats: CampaignAccessStats,
    responsible: CampaignUser,
    createdAt: z.string(),
    updatedAt: z.string(),
    createdBy: z.string(),
})

export const getCampaignActiveRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get(
        "/campaigns/active",
        {
            preHandler: [authenticate],
            schema: {
                title: "Get Campaigns Active",
                description: "Get Campaigns Active",
                tags: ["Campaigns"],
                querystring: z.object({
                    status: CampaignStatusSchema.optional(),
                    monthYear: z.string().optional(),
                    text: z.string().optional(),
                    page: z.coerce.number().default(1),
                    perPage: z.coerce.number().default(10),
                }),
                response: {
                    200: z.object({
                        campaign: Campaign.nullable(),
                    }),
                    500: z.object({
                        message: z.string()
                    })
                },
            },
        },
        async (request, reply) => {
            try {
                const { sub } = request.user
                const currentDate = new Date()

                const monthYear = currentDate.toISOString().slice(0, 7)

                const campaign = await prisma.campaigns.findFirst({
                    where: {
                        st_status: "PUBLISHED",
                        ds_month_year: monthYear,
                        dt_publication: {
                            lte: currentDate,
                        },
                    },
                    include: {
                        campaign_user_access: true
                    }
                })

                if (!campaign) {
                    return reply.status(200).send({
                        campaign: null
                    })
                }

                const campaignUser = await prisma.campaign_user_access.findFirst({
                    where: {
                        cd_user: Number(sub),
                        cd_campaign: Number(campaign.cd_campaign),
                        dt_completed: null
                    },
                    include: {
                        users: true
                    }
                })

                if (!campaignUser) {
                    return reply.status(200).send({
                        campaign: null
                    })
                }
                const accesses = campaign.campaign_user_access;

                const total = accesses.length;

                const accessed = accesses.filter(
                    (access) => access.dt_accessed !== null
                ).length;

                const viewed = accesses.filter(
                    (access) => access.dt_first_seen !== null
                ).length;

                const ignored = accesses.filter(
                    (access) => access.dt_dismissed !== null
                ).length;

                const pending = accesses.filter(
                    (access) =>
                        access.dt_first_seen === null &&
                        access.dt_accessed === null &&
                        access.dt_dismissed === null
                ).length;

                const accessRate =
                    total > 0
                        ? Math.round((accessed / total) * 1000) / 10
                        : 0;

                const status = campaign.st_status as CampaignStatus

                const campaignFormated = {
                    id: campaign.cd_campaign,
                    code: campaign.cd_code,
                    title: campaign.ds_title,
                    description: campaign.ds_description ?? null,
                    monthYear: campaign.ds_month_year,
                    publishDate: campaign.dt_publication?.toISOString() ?? null,
                    status,
                    url: campaign.ds_publication_url ?? null,
                    accessStats: {
                        total,
                        accessed,
                        viewed,
                        pending,
                        ignored,
                        accessRate,
                    },
                    responsible: {
                        id: campaignUser.users.cd_id,
                        name: campaignUser.users.ds_name,
                        avatarUrl: campaignUser.users.ds_avatar_url ?? null,
                        email: campaignUser.users.ds_email
                    },
                    createdAt: campaign.dt_created.toISOString(),
                    updatedAt: campaign.dt_updated.toISOString(),
                    createdBy: campaignUser.users.ds_name
                }

                return reply.status(200).send({
                    campaign: campaignFormated,
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
