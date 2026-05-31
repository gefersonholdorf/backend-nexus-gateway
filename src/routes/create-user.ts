import { prisma } from "@/db/prisma";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import bcrypt from 'bcrypt'

export const createUserRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post('/users', {
        schema: {
            body: z.object({
                name: z.string(),
                email: z.email(),
                password: z.string()
            })
        }
    }, async (request, reply) => {
        const { name, email, password } = request.body

        const hash = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hash
            }
        })

        return {
            id: user.id
        }
    })
}