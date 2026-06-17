import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import bcrypt from "bcrypt";

export const changePasswordMeRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().put(
		"/change-password/me",
		{
			preHandler: [authenticate, hasPermission("users.update")],
			schema: {
				title: "Update Password my User",
				description: "Update Password my User",
				tags: ["Users"],
				body: z.object({
					password: z.string(),
				}),
				response: {
					200: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { password } = request.body;
			const { sub } = request.user;

			const hash = await bcrypt.hash(password, 10);

			await prisma.users.update({
				where: {
					cd_id: Number(sub),
				},
				data: {
					password: hash,
				},
			});

			return reply.status(200).send({
				message: "User password updated successfully.",
			});
		},
	);
};
