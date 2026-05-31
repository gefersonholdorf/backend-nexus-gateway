import { prisma } from "@/db/prisma";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import bcrypt from "bcrypt";

export const loginRoute = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/login",
    {
      schema: {
        body: z.object({
          email: z.email(),
          password: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!user) {
        return reply.status(401).send({
          message: "E-mail ou senha inválidos",
        });
      }

      const passwordMatch = await bcrypt.compare(
        password,
        user.password
      );

      if (!passwordMatch) {
        return reply.status(401).send({
          message: "E-mail ou senha inválidos",
        });
      }

      const token = await reply.jwtSign(
        {
          email: user.email,
        },
        {
          sub: user.id,
          expiresIn: "7d",
        }
      );

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    }
  );
};