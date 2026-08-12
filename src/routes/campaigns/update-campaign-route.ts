import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const updateCampaignRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().put(
        "/campaigns/:idCampaign",
        {
            preHandler: [authenticate],
            schema: {
                title: "Update Campaign",
                description: "Update a new Campaign.",
                tags: ["Campaigns"],
                params: z.object({
                    idCampaign: z.coerce.number()
                }),
                body: z.object({
                    code: z.string(),
                    title: z.string(),
                    description: z.string(),
                    monthYear: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "monthYear must be in YYYY-MM format"),
                    publishDate: z.string().nullable(),
                    status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "INACTIVE"]),
                    url: z.url()
                }),
                response: {
                    200: z.object({
                        message: z.string(),
                    }),
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
            const { code, description, monthYear, publishDate, status, title, url } = request.body;
            const { idCampaign } = request.params
            const { sub } = request.user

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

                    const existingCampaignByMonthYear = await tx.campaigns.findFirst({
                        where: {
                            cd_campaign: {
                                not: Number(idCampaign)
                            },
                            ds_month_year: monthYear,
                        },
                        select: {
                            cd_campaign: true,
                        },
                    });

                    if (existingCampaignByMonthYear) {
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

                    const campaign = await tx.campaigns.update({
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
                        where: {
                            cd_campaign: idCampaign
                        }
                    });

                    return campaign;
                });

                return reply.status(200).send({
                    message: "Campaign successfully updated"
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
