import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { LoginNasService } from "@/services/backups/login-nas";
import cron from "node-cron";

interface GetJobsNasResponse {
    data: {
        tasks: {
            action: string
            can_delete: boolean
            can_edit: boolean
            can_run: boolean
            enable: boolean
            id: number,
            name: string
            next_trigger_time: string
            owner: string
            real_owner: string
            type: string
        }[]
    }
}

function parseNasDate(date: string) {
    return new Date(date.replace(" ", "T") + "-03:00");
}

export function startBackupSyncWorker() {
    cron.schedule("*/30 * * * *", async () => {
        console.log("[BACKUP SYNC] Iniciando sincronização", new Date());

        try {
            const service = new LoginNasService()

            const resultService = await service.execute({
                account: env.NAS_LOGIN,
                passwd: env.NAS_PASSWORD,
            });

            const { right, left } = resultService;

            if (left) {
                console.log("[BACKUP SYNC] Finalizado. Erro ao realizar login no NAS SYNOLOGY");
                return
            }

            const { data } = right?.result;

            const url = `${env.NAS_URL}webapi/entry.cgi?api=SYNO.Core.TaskScheduler&method=list&version=3&sort_by=next_trigger_time&sort_direction=ASC&offset=0&limit=50&_sid=${data.sid}`;

            const responseGetJobsNas = await fetch(url, {
                method: "GET",
                headers: {
                    "X-SYNO-TOKEN": data.synotoken,
                },
            });

            const result = await responseGetJobsNas.json() as GetJobsNasResponse;

            const backupsJobs = await prisma.backup_jobs.findMany()
            const tasksNas = result.data.tasks;

            for (const backupJob of backupsJobs) {
                const taskNas = tasksNas.find(
                    task => task.id === backupJob.cd_backup_automation
                );

                if (!taskNas) {
                    console.log(
                        `[BACKUP SYNC] Job ${backupJob.cd_backup_automation} não encontrado no NAS`
                    );
                    continue;
                }
                const nextTriggerDate = parseNasDate(taskNas.next_trigger_time);

                const nextTriggerTimeChanged =
                    !backupJob.dt_next_executation_at ||
                    backupJob.dt_next_executation_at.getTime() !== nextTriggerDate.getTime();


                if (nextTriggerTimeChanged) {

                    await prisma.backup_jobs.update({
                        where: {
                            cd_id: backupJob.cd_id
                        },
                        data: {
                            dt_next_executation_at: new Date(
                                taskNas.next_trigger_time
                            ),
                            dt_updated_at: new Date()
                        }
                    });


                    console.log(
                        `[BACKUP SYNC] Atualizado job ${backupJob.cd_backup_automation}`
                    );
                }
            }

            console.log("[BACKUP SYNC] Finalizado");

        } catch (error) {

            console.error(
                "[BACKUP SYNC] Erro",
                error
            );
        }
    });
}