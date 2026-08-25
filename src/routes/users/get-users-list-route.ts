import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getUsersListRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/users/list",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Users List",
				description: "Get Users List",
				tags: ["Users"],
				response: {
					200: z.object({
						users: z.array(
							z.object({
								id: z.number(),
								name: z.string(),
								avatarUrl: z.string().nullable(),
							}),
						),
					}),
					500: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (_, reply) => {
			try {
				const users = await prisma.users.findMany();

				const usersFormatted = users.map((user) => {
					return {
						id: user.cd_id,
						name: user.ds_name,
						avatarUrl: user.ds_avatar_url ?? null,
					};
				});

				return reply.status(200).send({
					users: usersFormatted,
				});
			} catch (error) {
				console.error(error);
				return reply.status(500).send({
					message: "Internal server error.",
				});
			}
		},
	);
};
