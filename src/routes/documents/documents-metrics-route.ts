import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import dayjs, { Dayjs } from "dayjs";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const documentMetricsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/documents/metrics", {
        preHandler: [authenticate],
        schema: {
            title: "Get Documents Metrics",
            description: "Get Documents Metrics",
            tags: ["Documents"],
            querystring: z.object({
                period: z.enum([
                    "7d",
                    "30d",
                    "90d",
                    "1y",
                    "ytd",
                ]).default("30d"),
            }),
            response: {
                200: z.object({
                    metrics: z.object({
                        totalDocuments: z.number(),
                        totalPolicy: z.number(),
                        totalProcedure: z.number(),
                        totalManual: z.number(),
                        totalAccess: z.number(),
                        totalDocumentsNeverAccessed: z.number(),
                        evolutionAccess: z.array(z.object({
                            label: z.string(),
                            access: z.number()
                        })),
                        usersRanking: z.array(z.object({
                            id: z.number(),
                            name: z.string(),
                            avatarUrl: z.string().nullable(),
                            total: z.number()
                        })),
                        documentsByCategory: z.array(z.object({
                            name: z.string(),
                            total: z.number()
                        })),
                        documentsByStatus: z.array(z.object({
                            name: z.string(),
                            total: z.number()
                        }))
                    }),
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (request, reply) => {
        try {
            const { period } = request.query;

            const { startDate, endDate } = getPeriod(period);
            const group = getGroupBy(period);
            const [totalDocuments, totalPolicy, totalProcedure, totalManual, totalAccess, totalDocumentsNeverAccessed] = await prisma.$transaction([
                prisma.documents.count({
                    where: {
                        dt_created_at: {
                            gte: startDate.toDate(),
                            lte: endDate.toDate(),
                        },
                    },
                }),

                prisma.documents.count({
                    where: {
                        dt_created_at: {
                            gte: startDate.toDate(),
                            lte: endDate.toDate(),
                        },
                        ds_category: "Política"
                    },
                }),

                prisma.documents.count({
                    where: {
                        dt_created_at: {
                            gte: startDate.toDate(),
                            lte: endDate.toDate(),
                        },
                        ds_category: "Procedimento"
                    },
                }),

                prisma.documents.count({
                    where: {
                        dt_created_at: {
                            gte: startDate.toDate(),
                            lte: endDate.toDate(),
                        },
                        ds_category: "Manual"
                    },
                }),

                prisma.documents_events.count({
                    where: {
                        dt_created_at: {
                            gte: startDate.toDate(),
                            lte: endDate.toDate(),
                        }
                    }
                }),

                prisma.documents.count({
                    where: {
                        dt_created_at: {
                            gte: startDate.toDate(),
                            lte: endDate.toDate(),
                        },
                        documents_events: {
                            none: {}
                        }
                    }
                })
            ])

            const evolutionAccess = await prisma.$queryRawUnsafe<
                { label: string; total: bigint }[]
            >(
                `
                SELECT
                    ${group.select} AS label,
                    COUNT(*) AS total
                FROM documents_events
                WHERE dt_created_at BETWEEN ? AND ?
                GROUP BY ${group.groupBy}
                ORDER BY MIN(dt_created_at)
                `,
                startDate.toDate(),
                endDate.toDate()
            );
            const chartAccess = buildEvolution(
                period,
                startDate,
                endDate,
                evolutionAccess
            );

            const usersRanking = await prisma.$queryRaw<
                {
                    cd_id: number;
                    ds_name: string;
                    ds_avatar_url: string | null;
                    total: number;
                }[]
            >`
                SELECT
                    u.cd_id,
                    u.ds_name,
                    u.ds_avatar_url,
                    COUNT(e.cd_id) AS total
                FROM users u
                LEFT JOIN documents_events e
                    ON e.cd_user_id = u.cd_id
                    AND e.dt_created_at BETWEEN ${startDate.toDate()} AND ${endDate.toDate()}
                GROUP BY
                    u.cd_id,
                    u.ds_name,
                    u.ds_avatar_url
                ORDER BY total DESC, u.ds_name ASC;
            `;

            const usersRankingFormatted = usersRanking.map(item => ({
                id: Number(item.cd_id),
                name: item.ds_name,
                avatarUrl: item.ds_avatar_url,
                total: Number(item.total),
            }));

            const documentsByCategory = await prisma.$queryRaw<
                {
                    ds_category: string;
                    total: number;
                }[]
            >`
                SELECT
                    d.ds_category,
                    COUNT(de.cd_id) AS total
                FROM documents d
                LEFT JOIN documents_events de
                    ON de.cd_document_id = d.cd_id
                WHERE d.dt_created_at BETWEEN ${startDate.toDate()} AND ${endDate.toDate()}
                GROUP BY
                    d.ds_category
                ORDER BY
                    total DESC;
            `;

            const documentsByCategoryFormatted = documentsByCategory.map(item => ({
                name: item.ds_category,
                total: Number(item.total),
            }));

            const documentsByStatus = await prisma.$queryRaw<
                {
                    ds_status: string;
                    total: number;
                }[]
            >`
                SELECT
                    s.ds_status,
                    COUNT(de.cd_id) AS total
                FROM (
                    SELECT 'Vigente' AS ds_status
                    UNION ALL
                    SELECT 'Em Andamento'
                    UNION ALL
                    SELECT 'Em Revisão'
                    UNION ALL
                    SELECT 'Pendente'
                ) s
                LEFT JOIN documents d
                    ON d.ds_status = s.ds_status AND d.dt_created_at BETWEEN ${startDate.toDate()} AND ${endDate.toDate()}
                LEFT JOIN documents_events de
                    ON de.cd_document_id = d.cd_id
                GROUP BY
                    s.ds_status
                ORDER BY
                    FIELD(
                        s.ds_status,
                        'Vigente',
                        'Em Andamento',
                        'Em Revisão',
                        'Pendente'
                    );
            `;

            const documentsByStatusFormatted = documentsByStatus.map(item => ({
                name: item.ds_status,
                total: Number(item.total),
            }));

            return reply.status(200).send({
                metrics: {
                    totalDocuments,
                    totalPolicy,
                    totalProcedure,
                    totalManual,
                    totalAccess,
                    totalDocumentsNeverAccessed,
                    evolutionAccess: chartAccess,
                    usersRanking: usersRankingFormatted,
                    documentsByCategory: documentsByCategoryFormatted,
                    documentsByStatus: documentsByStatusFormatted
                }
            })
        } catch (error) {
            console.error(error)
            return reply.status(500).send({
                message: "Internal server error."
            })
        }
    })
}

function getPeriod(period: "7d" | "30d" | "90d" | "1y" | "ytd") {
    const endDate = dayjs();

    switch (period) {
        case "7d":
            return {
                startDate: endDate.subtract(7, "day").startOf("day"),
                endDate,
            };

        case "30d":
            return {
                startDate: endDate.subtract(30, "day").startOf("day"),
                endDate,
            };

        case "90d":
            return {
                startDate: endDate.subtract(90, "day").startOf("day"),
                endDate,
            };

        case "1y":
            return {
                startDate: endDate.subtract(1, "year").startOf("day"),
                endDate,
            };

        case "ytd":
            return {
                startDate: endDate.startOf("year"),
                endDate,
            };
    }
}

function getGroupBy(period: "7d" | "30d" | "90d" | "1y" | "ytd") {
    switch (period) {
        case "7d":
        case "30d":
            return {
                select: "DATE(dt_created_at)",
                groupBy: "DATE(dt_created_at)",
                type: "day",
            };

        case "90d":
            return {
                select: "YEARWEEK(dt_created_at, 1)",
                groupBy: "YEARWEEK(dt_created_at, 1)",
                type: "week",
            };

        case "1y":
        case "ytd":
            return {
                select: "DATE_FORMAT(dt_created_at,'%Y-%m')",
                groupBy: "DATE_FORMAT(dt_created_at,'%Y-%m')",
                type: "month",
            };
    }
}

function fillDailyEvolution(
    startDate: Dayjs,
    endDate: Dayjs,
    data: { label: string; total: bigint }[]
) {
    const map = new Map(
        data.map(item => [
            dayjs(item.label).format("YYYY-MM-DD"),
            Number(item.total)
        ])
    );

    const result = [];

    let current = startDate.clone();

    while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
        const key = current.format("YYYY-MM-DD");

        result.push({
            label: current.format("DD/MM"),
            access: map.get(key) ?? 0,
        });

        current = current.add(1, "day");
    }

    return result;
}

function fillMonthlyEvolution(
    startDate: Dayjs,
    endDate: Dayjs,
    data: { label: string; total: bigint }[]
) {
    const map = new Map(
        data.map(item => [
            item.label,
            Number(item.total)
        ])
    );

    const result: {
        label: string;
        access: number;
    }[] = [];

    let current = startDate.startOf("month");

    while (
        current.isBefore(endDate, "month") ||
        current.isSame(endDate, "month")
    ) {
        const key = current.format("YYYY-MM");

        result.push({
            label: current.format("MMM"),
            access: map.get(key) ?? 0
        });

        current = current.add(1, "month");
    }

    return result;
}

function buildEvolution(
    period: "7d" | "30d" | "90d" | "1y" | "ytd",
    startDate: Dayjs,
    endDate: Dayjs,
    data: { label: string; total: bigint }[]
) {
    switch (period) {
        case "7d":
        case "30d":
            return fillDailyEvolution(startDate, endDate, data);

        case "1y":
        case "ytd":
            return fillMonthlyEvolution(startDate, endDate, data);

        case "90d":
            return fillDailyEvolution(startDate, endDate, data);
    }
}