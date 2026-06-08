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

      const user = await prisma.users.findUnique({
        where: {
          ds_email: email,
        },
      });

      if (!user) {
        return reply.status(401).send({
          message: "E-mail ou senha inválidos",
        });
      }

      const passwordMatch = await bcrypt.compare(
        password,
        user.ds_password
      );

      if (!passwordMatch) {
        return reply.status(401).send({
          message: "E-mail ou senha inválidos",
        });
      }

      const token = await reply.jwtSign(
        {
          email: user.ds_email,
        },
        {
          sub: String(user.cd_id),
          expiresIn: "7d",
        }
      );

      return {
        token,
        user: {
          id: user.cd_id,
          name: user.ds_name,
          email: user.ds_email,
        },
      };
    }
  );
};