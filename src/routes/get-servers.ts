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

export const getServersRoute = async(app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post("/servers/:hostId", {
        schema: {
            params: z.object({
                hostId: z.coerce.number()
            }),
            body: z.object({
                hostName: z.string()
            })
        }
    },async (request, reply) => {

        const { hostId } = request.params
        const { hostName } = request.body

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
            method: "item.get",
            params: {
                hostids: hostId.toString(),
                output: [
                "itemid",
                "name",
                "key_",
                "lastvalue"
                ]
            },
            id: 1
            })
        }
        )

        const itemsData = await itemsResponse.json() as ZabbixItemsResponse

        const items = itemsData.result

        const cpu = items.find(
            item => item.key_ === "system.cpu.util"
        )

        const memory = items.find(
            item => item.key_ === "vm.memory.utilization"
        )

        const disk = items.find(
            item => item.key_ === "vfs.fs.dependent.size[/etc/hostname,pused]"
        )

        const uptime = items.find(
            item => item.key_ === "system.uptime"
        )

        const server: ServerMetrics = {
            hostId: hostId.toString(),
            name: hostName,
            up: Number(uptime?.lastvalue ?? 0) > 0,
            cpu: Number(cpu?.lastvalue ?? 0),
            memory: Number(memory?.lastvalue ?? 0),
            disk: Number(disk?.lastvalue ?? 0),
            uptime: Number(uptime?.lastvalue ?? 0)
        }
        
        return reply.status(200).send({
            server
        })  
    })
}