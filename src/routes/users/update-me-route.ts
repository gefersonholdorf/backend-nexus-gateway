import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const updateMeRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().put(
		"/users/me",
		{
			preHandler: [authenticate, hasPermission("users.update")],
			schema: {
				title: "Update My User",
				description: "Update my user",
				tags: ["Users"],
				body: z.object({
					name: z.string(),
				}),
				response: {
					200: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { name } = request.body;
			const { sub } = request.user;

			await prisma.users.update({
				where: {
					cd_id: Number(sub),
				},
				data: {
					name,
				},
			});

			return reply.status(200).send({
				message: "User updated successfully.",
			});
		},
	);
};
