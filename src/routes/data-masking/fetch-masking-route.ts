import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export const fetchMaskingRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/maskings", {
        preHandler: [authenticate],
        schema: {
            title: "Fetch Maskings",
            description: "Fetch Maskings",
            tags: ["Data Maskings"],
            querystring: z.object({
                page: z.coerce.number().default(1),
                perPage: z.coerce.number().default(10),
            }),
            response: {
                200: z.object({
                    maskings: z.array(z.object({
                        id: z.number(),
                        executionId: z.string(),
                        path: z.string(),
                        status: z.string(),
                        dsEnvironment: z.string(),
                        databasesExpected: z.number(),
                        databasesProcessed: z.number(),
                        databasesSuccess: z.number(),
                        databasesError: z.number(),
                        recordsProcessed: z.number(),
                        startedAt: z.string(),
                        finishedAt: z.string(),
                    })),
                    pagination: z.object({
                        page: z.number(),
                        perPage: z.number(),
                        total: z.number(),
                        totalPages: z.number(),
                        hasNextPage: z.boolean(),
                        hasPreviousPage: z.boolean(),
                    }),
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (request, reply) => {
        try {
            const { page, perPage } = request.query

            const [maskings, total] = await Promise.all([
                prisma.masking_executions.findMany({
                    skip: (page - 1) * perPage,
                    take: perPage,
                    orderBy: {
                        dt_finished_at: "desc",
                    },
                }),
                prisma.masking_executions.count(),
            ]);

            const maskingFormated = maskings.map((item) => {
                return {
                    id: item.cd_id,
                    executionId: item.ds_execution_id,
                    path: item.ds_path,
                    status: item.st_status,
                    dsEnvironment: item.ds_environment,
                    databasesExpected: item.cd_databases_expected,
                    databasesProcessed: item.cd_databases_processed,
                    databasesSuccess: item.cd_databases_success,
                    databasesError: item.cd_databases_error,
                    recordsProcessed: item.cd_records_processed,
                    startedAt: item.dt_started_at.toISOString(),
                    finishedAt: item.dt_finished_at.toISOString(),
                }
            })

            return reply.status(200).send({
                maskings: maskingFormated,
                pagination: {
                    page,
                    perPage,
                    total,
                    totalPages: Math.ceil(total / perPage),
                    hasNextPage: page < Math.ceil(total / perPage),
                    hasPreviousPage: page > 1,
                },
            })
        } catch (error) {
            console.error(error)
            return reply.status(500).send({
                message: "Internal server error."
            })
        }
    })
}