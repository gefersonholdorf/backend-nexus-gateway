import { env } from "@/env";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z, { ZodType } from "zod";

function normalizeStatus(status: string): keyof Summary {
    const value = status.trim().toLowerCase()

    if (
        value.includes('conclu') ||
        value.includes('produção') ||
        value.includes('done') ||
        value.includes('finalizado')
    ) {
        return 'completed'
    }

    if (
        value.includes('corre')
    ) {
        return 'correction'
    }

    if (
        value.includes('andamento') ||
        value.includes('teste') ||
        value.includes('review') ||
        value.includes('homolog')
    ) {
        return 'inProgress'
    }

    return 'pending'
}

type Summary = {
    pending: number
    inProgress: number
    correction: number
    completed: number
}

export const getSummaryJira = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get('/jira', {
        preHandler: [authenticate],
        schema: {
            title: "Get Summary Tasks Jira",
            description: "Get Summary Tasks Jira",
            tags: ["JIRA"],
            response: {
                200: z.object({
                    total: z.number(),
                    summary: z.object({
                        pending: z.number(),
                        inProgress: z.number(),
                        correction: z.number(),
                        completed: z.number(),
                    }),
                    rawStatus: z.record(z.string(), z.number())
                }),
                404: z.object({
                    message: z.string(),
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (request, reply) => {
        const { email } = request.user
        try {
            const startDate = '2026-06-01'
            const endDate = '2026-06-30'

            const jql = `
                        assignee = "${email}"
                        AND updated >= "${startDate}"
                        AND updated <= "${endDate}"
                    `
            const response = await fetch(
                'https://lusati.atlassian.net/rest/api/3/search/jql',
                {
                    method: 'POST',
                    headers: {
                        Authorization:
                            'Basic ' +
                            Buffer.from(
                                `geferson@lusati.com.br:${env.TOKEN_JIRA}`
                            ).toString('base64'),
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jql,
                        maxResults: 1000,
                        fields: ['status']
                    })
                }
            )

            const result: any = await response.json()

            const summary: Summary = {
                pending: 0,
                inProgress: 0,
                correction: 0,
                completed: 0,
            }

            const rawStatus: Record<string, number> = {}

            result?.issues?.forEach((issue: any) => {
                const status = issue.fields.status.name

                rawStatus[status] =
                    (rawStatus[status] || 0) + 1

                const normalizedStatus = normalizeStatus(status)

                summary[normalizedStatus]++
            })

            return reply.send({
                total: result?.issues?.length ?? 0,
                summary,
                rawStatus
            })
        } catch (error) {
            console.error(error)

            return reply.status(500).send({
                message: 'Internal server error.'
            })
        }
    })
}