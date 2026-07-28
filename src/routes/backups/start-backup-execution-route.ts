import { prisma } from "@/db/prisma";
import { backupWebSocketManager } from "@/websocket/backup-connections";
import { deepStrictEqual } from "assert";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const startBackupExecutionRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post("/backups/executions/start", {
        schema: {
            title: "Start Backup Execution",
            description: "Start Backup Execution",
            tags: ["Backups"],
            body: z.object({
                backupJobId: z.number()
            }),
            response: {
                201: z.object({
                    executionId: z.number()
                }),
                404: z.object({
                    message: z.string()
                }),
                500: z.object({
                    message: z.string()
                })
            }
        }
    }, async (request, reply) => {
        try {
            const { backupJobId } = request.body

            const backupJob = await prisma.backup_jobs.findFirst({
                where: {
                    cd_id: backupJobId
                }
            })

            if (!backupJob) {
                return reply.status(404).send({
                    message: "BackupJob not found"
                })
            }

            const executionId = await prisma.backup_executions.create({
                data: {
                    ds_execution_type: "AUTO",
                    dt_started_at: new Date(),
                    cd_backup_job: backupJob.cd_id
                }
            })

            backupWebSocketManager.broadcast({
                event: "operation.started",
                operation: {
                    id: String(executionId),
                    type: "BACKUP",
                    title: "diamante_4009",
                    progress: 0,
                    status: "RUNNING",
                    startedAt: executionId.dt_started_at.toISOString(),
                }
            })

            return reply.status(201).send({
                executionId: executionId.cd_id
            })
        } catch (error) {
            console.error(error)
            return reply.status(500).send({
                message: "Internal server error."
            })
        }
    })
}