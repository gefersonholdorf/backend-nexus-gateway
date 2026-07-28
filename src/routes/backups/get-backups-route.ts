import { prisma } from "@/db/prisma";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getBackupsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/backups", {
        // preHandler: [authenticate],
        schema: {
            title: "Get Backups",
            description: "Get Backups",
            tags: ["Backups"],
            querystring: z.object({
                page: z.coerce.number().default(1),
                perPage: z.coerce.number().default(10),
            }),
            response: {
                200: z.object({
                    backups: z.array(
                        z.object({
                            id: z.number(),
                            backupAutomationIdNas: z.number(),
                            system: z.string(),
                            description: z.string(),
                            path: z.string(),
                            retentionDays: z.number(),
                            backupsDays: z.number(),
                            enabled: z.boolean(),
                            nextTriggerTime: z.string().nullable(),
                            createdAt: z.string(),
                            updatedAt: z.string()
                        })
                    ),
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
            const { page, perPage } = request.query;

            const total = await prisma.backup_jobs.count();

            const backupsJobs = await prisma.backup_jobs.findMany({
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: {
                    cd_id: "asc",
                },
            });

            const backups = backupsJobs.flatMap(backup => {
                return [{
                    id: backup.cd_id,
                    backupAutomationIdNas: backup.cd_backup_automation,
                    system: backup.ds_system,
                    description: backup.ds_description,
                    path: backup.ds_path,
                    retentionDays: backup.nr_retention_days,
                    backupsDays: backup.nr_backups_days,
                    nextTriggerTime: backup.dt_next_executation_at !== null ? backup.dt_next_executation_at.toISOString() : null,
                    enabled: backup.st_enabled === 1,
                    createdAt: backup.dt_created_at.toISOString(),
                    updatedAt: backup.dt_updated_at.toISOString(),
                }];
            });

            const totalPages = Math.ceil(total / perPage);

            return reply.send({
                backups,
                pagination: {                                               
                    page,
                    perPage,
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                },
            });
        } catch (error) {
            console.error(error);

            return reply.status(500).send({
                message: "Internal server error",
            });
        }
    })
}