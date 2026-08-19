import { prisma } from "@/db/prisma";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const createEventBackupExecutionRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post("/backups/executions/events", {
            schema: {
                title: "Register Event By Execution",
                description: "Register Event By Execution",
                tags: ["Backups"],
                body: z.object({
                    executionId: z.number(),
                    event: z.string(),
                    message: z.string(),
                    status: z.boolean()
                }),
                response: {
                    201: z.object({
                        eventId: z.number()
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
                const { event, executionId, message } = request.body

                const executionBackup = await prisma.backup_executions.findFirst({
                    where: {
                        cd_id: executionId
                    }
                })

                if(!executionBackup) {
                    return reply.status(404).send({
                        message: "Execution not found"
                    })
                }

                const eventId = await prisma.backup_execution_events.create({
                    data: {
                        tp_event: event,
                        ds_message: message,
                        cd_backup_execution: executionId
                    }
                })

                return reply.status(201).send({
                    eventId: eventId.cd_id
                })
            } catch (error) {
                console.error(error)
                return reply.status(500).send({
                    message: "Internal server error."
                })
            }
    })
}