import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { LoginNasService } from "@/services/backups/login-nas";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { SynologyFileListResponse } from "./types/response-backups-folders";
import { authenticate } from "@/middlewares/authenticate";

const backupReportSchema = z.object({
    backupJob: z.object({
        cd_id: z.number(),
        cd_backup_automation: z.number(),
        ds_system: z.string(),
        ds_description: z.string().nullable(),
        ds_path: z.string(),
        nr_retention_days: z.number(),
        nr_backups_days: z.number(),
        st_enabled: z.number(),
        dt_next_executation_at: z.date().nullable(),
        dt_created_at: z.date(),
        dt_updated_at: z.date(),
    }),
    executions: z.array(
        z.object({
            date: z.string(),
            path: z.string(),
            createdAt: z.number(),
            updatedAt: z.number(),
            files: z.array(
                z.object({
                    name: z.string(),
                    path: z.string(),
                    size: z.number(),
                    type: z.string(),
                    createdAt: z.number(),
                    updatedAt: z.number(),
                })
            ),
        })
    ),
});

export const getReportsBackupsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/reports/backups", {
        preHandler: [authenticate],
        schema: {
            title: "Generate Report Backups",
            description: "Generate Report Backups",
            tags: ["Reports"],
            response: {
                200: z.object({
                    backups: z.array(backupReportSchema),
                    statistics: z.object({
                        totalJobs: z.number(),
                        totalBackups: z.number(),
                        totalSize: z.number()
                    }),
                    generatedBy: z.string()
                }),
                422: z.object({
                    message: z.string()
                }),
                500: z.object({
                    message: z.string()
                })
            }
        },
    }, async (request, reply) => {
        try {
            const { name } = request.user
            const service = new LoginNasService();

            const resultService = await service.execute({
                account: env.NAS_LOGIN,
                passwd: env.NAS_PASSWORD,
            });

            const { right, left } = resultService;

            if (left) {
                return reply.status(422).send({
                    message: "Erro ao realizar login no NAS.",
                });
            }

            const { data } = right.result;

            const backups = await prisma.backup_jobs.findMany();

            const results = await Promise.all(
                backups.map(async (backup) => {

                    const url = `${env.NAS_URL}webapi/entry.cgi?_sid=${data.sid}`;
                    const foldersBody = new URLSearchParams();

                    foldersBody.append("api", "SYNO.FileStation.List");
                    foldersBody.append("method", "list");
                    foldersBody.append("version", "2");
                    foldersBody.append("offset", "0");
                    foldersBody.append("limit", "7");
                    foldersBody.append("sort_by", "name");
                    foldersBody.append("sort_direction", "DESC");
                    foldersBody.append("action", "list");
                    foldersBody.append("check_dir", "true");
                    foldersBody.append(
                        "additional",
                        JSON.stringify([
                            "real_path",
                            "size",
                            "owner",
                            "time",
                            "perm",
                            "type",
                            "mount_point_type",
                            "description",
                            "indexed",
                        ])
                    );
                    foldersBody.append("filetype", "all");
                    foldersBody.append("folder_path", backup.ds_path);

                    const foldersResponse = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "X-SYNO-TOKEN": data.synotoken,
                        },
                        body: foldersBody,
                    });

                    const foldersResult =
                        await foldersResponse.json() as SynologyFileListResponse;
                    const executions = await Promise.all(
                        foldersResult.data.files
                            .filter(folder => folder.isdir)
                            .map(async (folder) => {

                                const filesBody = new URLSearchParams();

                                filesBody.append("api", "SYNO.FileStation.List");
                                filesBody.append("method", "list");
                                filesBody.append("version", "2");
                                filesBody.append("offset", "0");
                                filesBody.append("limit", "1000");
                                filesBody.append("sort_by", "name");
                                filesBody.append("sort_direction", "ASC");
                                filesBody.append("action", "list");
                                filesBody.append("check_dir", "true");
                                filesBody.append(
                                    "additional",
                                    JSON.stringify([
                                        "real_path",
                                        "size",
                                        "owner",
                                        "time",
                                        "perm",
                                        "type",
                                    ])
                                );
                                filesBody.append("filetype", "all");
                                filesBody.append("folder_path", folder.path);

                                const filesResponse = await fetch(url, {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/x-www-form-urlencoded",
                                        "X-SYNO-TOKEN": data.synotoken,
                                    },
                                    body: filesBody,
                                });

                                const filesResult =
                                    await filesResponse.json() as SynologyFileListResponse;

                                return {
                                    date: folder.name,
                                    path: folder.path,
                                    createdAt: folder.additional.time.ctime,
                                    updatedAt: folder.additional.time.mtime,
                                    files: filesResult.data.files
                                        .filter(file => !file.isdir)
                                        .map(file => ({
                                            name: file.name,
                                            path: file.path,
                                            size: file.additional.size,
                                            type: file.additional.type,
                                            createdAt: file.additional.time.ctime,
                                            updatedAt: file.additional.time.mtime,
                                        })),
                                };
                            })
                    );

                    return {
                        backupJob: backup,
                        executions,
                    };
                })
            );

            const statistics = {
                totalJobs: results.length,
                totalBackups: results.reduce(
                    (acc, item) =>
                        acc +
                        item.executions.reduce(
                            (a, execution) => a + execution.files.length,
                            0
                        ),
                    0
                ),
                totalSize: results.reduce(
                    (acc, item) =>
                        acc +
                        item.executions.reduce(
                            (a, execution) =>
                                a +
                                execution.files.reduce(
                                    (b, file) => b + file.size,
                                    0
                                ),
                            0
                        ),
                    0
                ),
            };

            return reply.status(200).send({
                backups: results,
                statistics,
                generatedBy: name
            });

        } catch (error) {
            console.error(error);

            return reply.status(500).send({
                message: "Internal server error.",
            });
        }
    });
};