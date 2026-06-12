import { env } from "@/env";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

interface N8NGetUserPrivilegesResponse {
    result: {
        username: string
        name: string
        group: string
        status: string
        last_login: string
    }[]
}

export const getUsersPrivilegesRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post('/servers/privileges', {
        schema: {
            body: z.object({
                servers: z.array(z.string())
            })
        }
    }, async (request, reply) => {
        const { servers } = request.body

        const responses = await Promise.all(
            servers.map(async (server) => {
                const response = await fetch(
                    `${env.N8N_URL}/63f52470-6c1c-479b-aaeb-c2d40f3d0743/`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            server,
                        }),
                    }
                );

                const data =
                    (await response.json()) as N8NGetUserPrivilegesResponse;

                return {
                    server,
                    users: data.result,
                };
            })
        );
        
        return reply.status(200).send({
            serversUsersPrivileges: responses
        })
    })
}