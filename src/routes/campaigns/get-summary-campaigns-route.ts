import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const CampaignStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'INACTIVE'])
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>

export const getSummaryCampaignsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get(
        "/campaigns/summary",
        {
            preHandler: [authenticate],
            schema: {
                title: "Get Summary Campaigns",
                description: "Get Summary a Campaigns.",
                tags: ["Campaigns"],
                querystring: z.object({
                    status: CampaignStatusSchema.optional(),
                    monthYear: z.string().optional(),
                    text: z.string().optional(),
                }),
                response: {
                    200: z.object({
                        summary: z.object({
                            total: z.number(),
                            draft: z.number(),
                            scheduled: z.number(),
                            published: z.number(),
                            inactive: z.number(),
                        })
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
            const { status, text, monthYear } = request.query;

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
                    }),
                    prisma.campaigns.count({
                        where,
                    }),
                ]);

                const summary = {
                    total,
                    draft: campaigns.filter((item) => item.st_status === 'DRAFT').length,
                    scheduled: campaigns.filter((item) => item.st_status === 'SCHEDULED').length,
                    published: campaigns.filter((item) => item.st_status === 'PUBLISHED').length,
                    inactive: campaigns.filter((item) => item.st_status === 'INACTIVE').length,
                }

                return reply.status(200).send({
                    summary
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
