import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getSummaryMaskingsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get(
        "/maskings/summary",
        {
            preHandler: [authenticate],
            schema: {
                title: "Get Summary Maskings",
                description: "Get Summary a Maskings.",
                tags: ["Data Maskings"],
                response: {
                    200: z.object({
                        summary: z.object({
                            total: z.number(),
                            success: z.number(),
                            error: z.number(),
                            partialError: z.number(),
                        })
                    }),
                    404: z.object({
                        message: z.string(),
                    }),
                    500: z.object({
                        message: z.string()
                    })
                },
            },
        },
        async (_, reply) => {

            try {
                const [maskings, total] = await Promise.all([
                    prisma.masking_executions.findMany(),
                    prisma.masking_executions.count(),
                ]);

                const summary = {
                    total,
                    success: maskings.filter((item) => item.st_status === 'SUCCESS').length,
                    error: maskings.filter((item) => item.st_status === 'ERROR').length,
                    partialError: maskings.filter((item) => item.st_status === 'PARTIAL_ERROR').length,
                }


                return reply.status(200).send({
                    summary
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
