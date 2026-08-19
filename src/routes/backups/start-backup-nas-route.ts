import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { LoginNasService } from "@/services/backups/login-nas";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

interface TaskSchedulerNasResponse {
    data: {
        has_fail: boolean
        result:
        {
            api: string
            method: string
            success: boolean
            version: number
        }[]
    },
    success: boolean
}

export const startBackupRoute = async (app: FastifyInstance) => {

    const service = new LoginNasService()

    app.withTypeProvider<ZodTypeProvider>().post("/backups/start", {
        schema: {
            title: "Start Backup",
            description: "Start Backup",
            tags: ["Backups"],
            body: z.object({
                backupJobId: z.number()
            }),
            response: {
                202: z.object({
                    message: z.string(),
                }),
                404: z.object({
                    message: z.string()
                }),
                422: z.object({
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
                    message: "Backup job not found."
                })
            }

            const { left, right } = await service.execute({
                account: env.NAS_LOGIN,
                passwd: env.NAS_PASSWORD,
            });

            if (left) {
                return reply.status(422).send({
                    message: "Erro no login do NAS SYNOLOGY"
                })
            }

            const url = `${env.NAS_URL}/webapi/entry.cgi?_sid=${right.result.data.sid}`

            const body = new URLSearchParams();

            body.append("api", "SYNO.Entry.Request");
            body.append("method", "request");
            body.append("version", "1");
            body.append("mode", "sequential");
            body.append("stop_when_error", "false");

            body.append(
                "compound",
                JSON.stringify([
                    {
                        api: "SYNO.Core.TaskScheduler",
                        method: "run",
                        version: 2,
                        tasks: [
                            {
                                id: backupJob.cd_backup_automation,
                                real_owner: "root",
                            },
                        ],
                    },
                ])
            );

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "X-SYNO-TOKEN": right.result.data.synotoken,
                },
                body
            });

            const result = await response.json() as TaskSchedulerNasResponse;

            if (
                !result.success ||
                result.data.has_fail
            ) {
                console.error(result)
                return reply.status(422).send({
                    message: "Erro na inicialização da automação no NAS SYNOLOGY"
                });
            }

            console.log(result);

            return reply.status(202).send({
                message: "Automação iniciada no NAS SYNOLOGY."
            })

        } catch (error) {
            console.error(error)
            return reply.status(500).send({
                message: "Internal server error"
            })
        }
    })
}