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

export const getCampaignsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get(
        "/campaigns",
        {
            preHandler: [authenticate],
            schema: {
                title: "Get Campaigns",
                description: "Get Campaigns",
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
                        campaigns: z.array(Campaign),
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
            },
        },
        async (request, reply) => {
            const { monthYear, status, text, page, perPage } = request.query;

            const where = {
                ...(monthYear && {
                    ds_month_year: {
                        contains: monthYear,
                    }
                }),

                ...(status && {
                    st_status: status,
                }),

                ...(text && {
                    OR: [
                        {
                            cd_code: {
                                contains: text,
                            },
                        },
                        {
                            ds_title: {
                                contains: text,
                            },
                        },
                    ],
                }),
            };

            try {
                const [campaigns, total] = await Promise.all([
                    prisma.campaigns.findMany({
                        where,
                        skip: (page - 1) * perPage,
                        take: perPage,
                        orderBy: {
                            dt_updated: "desc",
                        },
                        include: {
                            users: true,
                            campaign_user_access: {
                                include: {
                                    campaigns: true
                                }
                            }
                        }
                    }),
                    prisma.campaigns.count({
                        where,
                    }),
                ]);

                const campaignsFormated = campaigns.map((campaign) => {
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
                    return {
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
                            id: campaign.users.cd_id,
                            name: campaign.users.ds_name,
                            avatarUrl: campaign.users.ds_avatar_url ?? null,
                            email: campaign.users.ds_email
                        },
                        createdAt: campaign.dt_created.toISOString(),
                        updatedAt: campaign.dt_updated.toISOString(),
                        createdBy: campaign.users.ds_name
                    }
                })

                return reply.status(200).send({
                    campaigns: campaignsFormated,
                    pagination: {
                        page,
                        perPage,
                        total,
                        totalPages: Math.ceil(total / perPage),
                        hasNextPage: page < Math.ceil(total / perPage),
                        hasPreviousPage: page > 1,
                    },
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
