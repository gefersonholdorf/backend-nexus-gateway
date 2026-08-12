import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const createCampaignRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post(
        "/campaigns",
        {
            preHandler: [authenticate],
            schema: {
                title: "Create Campaign",
                description: "Create a new Campaign.",
                tags: ["Campaigns"],
                body: z.object({
                    code: z.string(),
                    title: z.string(),
                    description: z.string(),
                    monthYear: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "monthYear must be in YYYY-MM format"),
                    publishDate: z.string().nullable(),
                    status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED"]),
                    url: z.url()
                }),
                response: {
                    201: z.object({
                        campaignId: z.number(),
                    }),
                    400: z.object({
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
            const { code, description, monthYear, publishDate, status, title, url } = request.body;
            const { sub } = request.user

            try {
                const campaign = await prisma.$transaction(async (tx) => {
                    const existingCampaign = await tx.campaigns.findUnique({
                        where: {
                            ds_month_year: monthYear,
                        },
                        select: {
                            cd_campaign: true,
                        },
                    });

                    if (existingCampaign) {
                        return reply.status(409).send({
                            message: "Já existe uma campanha cadastrada para este mês."
                        })
                    }

                    const monthYearDate = new Date(`${monthYear}-01T00:00:00`);
                    const publicationDate = new Date(publishDate!);

                    const sameMonth =
                        monthYearDate.getUTCFullYear() === publicationDate.getUTCFullYear() &&
                        monthYearDate.getUTCMonth() === publicationDate.getUTCMonth();

                    if (!sameMonth) {
                        return reply.status(400).send({
                            message: "A data de publicação deve pertencer ao mês selecionado.",
                        });
                    }


                    const campaign = await tx.campaigns.create({
                        data: {
                            cd_code: code,
                            ds_title: title,
                            ds_month_year: monthYear,
                            ds_description: description,
                            cd_owner: Number(sub),
                            ds_publication_url: url,
                            st_status: status,
                            st_active: true,
                            dt_publication: publicationDate ?? null
                        },
                    });

                    const users = await tx.users.findMany()

                    const campaignUsersData = users.map((user) => {
                        return {
                            cd_user: user.cd_id,
                            cd_campaign: campaign.cd_campaign
                        }
                    })

                    await tx.campaign_user_access.createMany({
                        data: campaignUsersData
                    })

                    return campaign;
                });

                return reply.status(201).send({
                    campaignId: campaign.cd_campaign,
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
