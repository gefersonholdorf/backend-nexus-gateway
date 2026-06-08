import { env } from "@/env";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

interface ZabbixLoginData {
    "jsonrpc": string
    "result": string
    "id": number
}

export interface ZabbixItem {
    itemid: string
    hostid: string
    name: string
    key_: string
    lastvalue: string
}

export interface ZabbixItemsResponse {
    jsonrpc: string
    result: ZabbixItem[]
    id: number
}

export interface ServerMetrics {
    hostId: string
    name: string
    up: boolean
    cpu: number
    memory: number
    disk: number
    uptime: number
}

export const getProblemsDetailsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post("/problems/details", {
        schema: {
            body: z.object({
                hostIds: z.array(z.number())
            })
        }
    }, async (request, reply) => {

        const { hostIds } = request.body

        const loginResponse = await fetch(`${env.ZABBIX_URL}/api_jsonrpc.php`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "user.login",
                params: {
                    username: env.ZABBIX_USERNAME,
                    password: env.ZABBIX_PASSWORD,
                },
                id: 1,
            }),
        })

        const loginData = await loginResponse.json() as ZabbixLoginData;

        const token = loginData.result;

        const itemsResponse = await fetch(`${env.ZABBIX_URL}/api_jsonrpc.php`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "problem.get",
                    params: {
                        hostids: hostIds,
                        output: "extend"
                    },
                    id: 1
                })
            }
        )

        const problemsData = await itemsResponse.json() as any

        return reply.status(200).send({
            problems: problemsData.result
        })
    })
}