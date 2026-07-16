import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

dayjs.extend(utc);

export const documentMetricsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/documents/metrics", {
        preHandler: [authenticate],
        schema: {
            title: "Get Documents Metrics",
            description: "Get Documents Metrics",
            tags: ["Documents"],
            querystring: z.object({
                period: z.enum([
                    "7d", "30d", "1y", "ds"
                ]).default("7d"),
            }),
            response: {
                200: z.object({
                    metrics: z.object({
                        totalDocuments: z.object({
                            value: z.number(),
                            growth: z.number()
                        }),
                        totalCurrentRate: z.object({
                            value: z.number(),
                            growth: z.number()
                        }),
                        totalAccess: z.object({
                            value: z.number(),
                            growth: z.number()
                        }),
                        totalDocumentsNeverAccessed: z.object({
                            value: z.number(),
                            growth: z.number()
                        }),
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
                        })),
                        documentAccessTable: z.array(z.object({
                            id: z.number(),
                            code: z.string(),
                            title: z.string(),
                            access: z.number(),
                            lastAccess: z.string().nullable()
                        })),
                        documentsByRolesPercentual: z.array(z.object({
                            name: z.string(),
                            total: z.number()
                        })),
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
            const dateFilter =
                startDate && endDate
                    ? {
                        dt_created_at: {
                            gte: startDate.toDate(),
                            lte: endDate.toDate(),
                        },
                    }
                    : {};

            const group = getGroupBy(period);
            const [totalDocuments, totalCurrentRate, totalAccess, totalDocumentsNeverAccessed] = await prisma.$transaction([
                prisma.documents.count({
                    where: {
                        ...dateFilter,
                    },
                }),

                prisma.documents.count({
                    where: {
                        ...dateFilter,
                        ds_status: "Vigente"
                    },
                }),

                prisma.documents_events.count({
                    where: {
                        ...dateFilter,
                    }
                }),

                prisma.documents.count({
                    where: {
                        ...dateFilter,
                        documents_events: {
                            none: {}
                        }
                    }
                })
            ])

            let previousTotalDocuments = 0;
            let previousTotalCurrentRate = 0;
            let previousTotalAccess = 0;
            let previousTotalDocumentsNeverAccessed = 0;

            if (period !== "ds") {
                const previous = getPreviousPeriod(period);

                [
                    previousTotalDocuments,
                    previousTotalCurrentRate,
                    previousTotalAccess,
                    previousTotalDocumentsNeverAccessed,
                ] = await prisma.$transaction([
                    prisma.documents.count({
                        where: {
                            dt_created_at: {
                                gte: previous.startDate.toDate(),
                                lte: previous.endDate.toDate(),
                            },
                        },
                    }),

                    prisma.documents.count({
                        where: {
                            dt_created_at: {
                                gte: previous.startDate.toDate(),
                                lte: previous.endDate.toDate(),
                            },
                            ds_status: "Vigente",
                        },
                    }),

                    prisma.documents_events.count({
                        where: {
                            dt_created_at: {
                                gte: previous.startDate.toDate(),
                                lte: previous.endDate.toDate(),
                            },
                        },
                    }),

                    prisma.documents.count({
                        where: {
                            dt_created_at: {
                                gte: previous.startDate.toDate(),
                                lte: previous.endDate.toDate(),
                            },
                            documents_events: {
                                none: {},
                            },
                        },
                    }),
                ]);
            }

            const evolutionAccess =
                period === "ds"
                    ? await prisma.$queryRawUnsafe<
                        { label: string; total: bigint }[]
                    >(
                        `
            SELECT
                ${group.select} AS label,
                COUNT(*) AS total
            FROM documents_events
            GROUP BY ${group.groupBy}
            ORDER BY MIN(dt_created_at)
            `
                    )
                    : await prisma.$queryRawUnsafe<
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
                        startDate!.toDate(),
                        endDate!.toDate()
                    );

            const chartAccess = buildEvolution(
                period,
                startDate,
                endDate,
                evolutionAccess
            );

            const usersRanking =
                period === "ds"
                    ? await prisma.$queryRaw<
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
            GROUP BY
                u.cd_id,
                u.ds_name,
                u.ds_avatar_url
            ORDER BY total DESC, u.ds_name ASC;
        `
                    : await prisma.$queryRaw<
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
                AND e.dt_created_at BETWEEN ${startDate!.toDate()} AND ${endDate!.toDate()}
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

            const documentsByCategory =
                period === "ds"
                    ? await prisma.$queryRaw<
                        {
                            ds_category: string;
                            total: number;
                        }[]
                    >`
            SELECT
                d.ds_category,
                COUNT(d.cd_id) AS total
            FROM documents d
            GROUP BY d.ds_category
            ORDER BY total DESC;
        `
                    : await prisma.$queryRaw<
                        {
                            ds_category: string;
                            total: number;
                        }[]
                    >`
            SELECT
                d.ds_category,
                COUNT(d.cd_id) AS total
            FROM documents d
            WHERE d.dt_created_at BETWEEN ${startDate!.toDate()} AND ${endDate!.toDate()}
            GROUP BY d.ds_category
            ORDER BY total DESC;
        `;

            const documentsByCategoryFormatted = documentsByCategory.map(item => ({
                name: item.ds_category,
                total: Number(item.total),
            }));

            const documentsByStatus = period === "ds"
                ? await prisma.$queryRaw<
                    {
                        ds_status: string;
                        total: number;
                    }[]
                >`
        SELECT
            s.ds_status,
            COUNT(d.cd_id) AS total
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
            ON d.ds_status = s.ds_status
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
    `
                : await prisma.$queryRaw<
                    {
                        ds_status: string;
                        total: number;
                    }[]
                >`
        SELECT
            s.ds_status,
            COUNT(d.cd_id) AS total
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
            ON d.ds_status = s.ds_status
            AND d.dt_created_at BETWEEN ${startDate!.toDate()} AND ${endDate!.toDate()}
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

            const documentAccessTable = await prisma.$queryRaw<
                {
                    cd_id: number,
                    ds_code: string,
                    ds_title: string
                    access: number
                    last_access: Date
                }[]
            >
                `
                SELECT
                    d.cd_id,
                    d.ds_code,
                    d.ds_title,
                    COALESCE(COUNT(de.cd_id), 0) AS access,
                    MAX(de.dt_created_at) AS last_access
                FROM documents d
                LEFT JOIN documents_events de 
                    ON de.cd_document_id = d.cd_id
                GROUP BY
                    d.cd_id,
                    d.ds_code,
                    d.ds_title
                ORDER BY
                    access DESC,
                    d.ds_title ASC
                LIMIT 5;
            `;

            const documentAccessTableFormated = documentAccessTable.map(item => ({
                id: Number(item.cd_id),
                code: item.ds_code,
                title: item.ds_title,
                access: Number(item.access),
                lastAccess: item.last_access
                    ? item.last_access.toISOString()
                    : null
            }));

            const currentValidityRate = totalDocuments > 0
                ? Number(((totalCurrentRate / totalDocuments) * 100).toFixed(2))
                : 0;

            const previousValidityRate = previousTotalDocuments > 0
                ? Number(((previousTotalCurrentRate / previousTotalDocuments) * 100).toFixed(2))
                : 0;

            const validityGrowth = calculateGrowth(
                currentValidityRate,
                previousValidityRate
            );

            const documentsByRolesPercentual = period === "ds"
                ? await prisma.$queryRaw<
                    {
                        name: string;
                        total: number;
                    }[]
                >`
        SELECT
            r.ds_name AS name,
            ROUND(
                (COUNT(DISTINCT d.cd_id) * 100.0) /
                (SELECT COUNT(*) FROM documents),
                2
            ) AS total
        FROM roles r
        LEFT JOIN documents_roles dr
            ON r.cd_id = dr.cd_role_id
        LEFT JOIN documents d
            ON d.cd_id = dr.cd_document_id
        GROUP BY
            r.cd_id,
            r.ds_name
        ORDER BY
            total DESC;
    `
                : await prisma.$queryRaw<
                    {
                        name: string;
                        total: number;
                    }[]
                >`
        SELECT
            r.ds_name AS name,
            ROUND(
                (COUNT(DISTINCT d.cd_id) * 100.0) /
                (SELECT COUNT(*) FROM documents),
                2
            ) AS total
        FROM roles r
        LEFT JOIN documents_roles dr
            ON r.cd_id = dr.cd_role_id
        LEFT JOIN documents d
            ON d.cd_id = dr.cd_document_id
            AND d.dt_created_at BETWEEN ${startDate!.toDate()} AND ${endDate!.toDate()}
        GROUP BY
            r.cd_id,
            r.ds_name
        ORDER BY
            total DESC;
    `;

            const documentsByRolesPercentualFormatted = documentsByRolesPercentual.map(item => ({
                name: item.name,
                total: Number(item.total),
            }));

            return reply.status(200).send({
                metrics: {
                    totalDocuments: {
                        value: totalDocuments,
                        growth: calculateGrowth(
                            totalDocuments,
                            previousTotalDocuments
                        ),
                    },
                    totalCurrentRate: {
                        value: currentValidityRate,
                        growth: validityGrowth,
                    },
                    totalAccess: {
                        value: totalAccess,
                        growth: calculateGrowth(totalAccess, previousTotalAccess),
                    },

                    totalDocumentsNeverAccessed: {
                        value: totalDocumentsNeverAccessed,
                        growth: calculateGrowth(
                            totalDocumentsNeverAccessed,
                            previousTotalDocumentsNeverAccessed
                        ),
                    },
                    evolutionAccess: chartAccess,
                    usersRanking: usersRankingFormatted,
                    documentsByCategory: documentsByCategoryFormatted,
                    documentsByStatus: documentsByStatusFormatted,
                    documentAccessTable: documentAccessTableFormated,
                    documentsByRolesPercentual: documentsByRolesPercentualFormatted
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

type Period = "7d" | "30d" | "1y" | "ds";

function calculateGrowth(current: number, previous: number) {
    if (previous === 0) {
        if (current === 0) return 0;
        return 100;
    }

    return Number((((current - previous) / previous) * 100).toFixed(2));
}

function getPreviousPeriod(period: Exclude<Period, "ds">) {
    const endDate = dayjs();

    switch (period) {
        case "7d":
            return {
                startDate: endDate.subtract(14, "day").startOf("day"),
                endDate: endDate.subtract(7, "day").endOf("day"),
            };

        case "30d":
            return {
                startDate: endDate.subtract(60, "day").startOf("day"),
                endDate: endDate.subtract(30, "day").endOf("day"),
            };

        case "1y":
            return {
                startDate: endDate.subtract(2, "year").startOf("day"),
                endDate: endDate.subtract(1, "year").endOf("day"),
            };
    }
}

function getPeriod(period: Period) {
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

        case "1y":
            return {
                startDate: endDate.subtract(1, "year").startOf("day"),
                endDate,
            };

        case "ds":
            return {
                startDate: null,
                endDate: null,
            };
    }
}

function getGroupBy(period: Period) {
    switch (period) {
        case "7d":
        case "30d":
            return {
                select: "DATE(dt_created_at)",
                groupBy: "DATE(dt_created_at)",
                type: "day",
            };

        case "1y":
        case "ds":
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
            dayjs.utc(item.label).format("YYYY-MM-DD"),
            Number(item.total),
        ])
    );

    const result: {
        label: string;
        access: number;
    }[] = [];

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
            Number(item.total),
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
            access: map.get(key) ?? 0,
        });

        current = current.add(1, "month");
    }

    return result;
}

function buildEvolution(
    period: Period,
    startDate: Dayjs | null,
    endDate: Dayjs | null,
    data: { label: string; total: bigint }[]
) {
    switch (period) {
        case "7d":
        case "30d":
            return fillDailyEvolution(
                startDate!,
                endDate!,
                data
            );

        case "1y":
            return fillMonthlyEvolution(
                startDate!,
                endDate!,
                data
            );

        case "ds": {
            if (data.length === 0) {
                return [];
            }

            const firstMonth = dayjs(data[0].label + "-01");
            const lastMonth = dayjs();

            return fillMonthlyEvolution(
                firstMonth,
                lastMonth,
                data
            );
        }
    }
}