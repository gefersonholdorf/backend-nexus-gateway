import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const fetchDocumentsUsersProfilesRoute = async (
	app: FastifyInstance,
) => {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/documents/profiles",
		{
			preHandler: [authenticate],
			schema: {
				title: "Get Profiles Users By Documents",
				description: "Get Profiles Users By Documents",
				tags: ["Documents"],
				response: {
					200: z.object({
						users: z.array(
							z.object({
								id: z.number(),
								name: z.string(),
								email: z.string(),
								avatarUrl: z.string().nullable(),
								roleDescription: z.string(),
								lastLogin: z.string().nullable(),
							}),
						),
					}),
					404: z.object({
						message: z.string(),
					}),
					500: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			try {
				const { sub } = request.user;
				const userId = Number(sub);

				const profilesByUser = await prisma.user_roles.findMany({
					where: {
						cd_user: userId,
					},
					include: {
						roles: true,
					},
				});

				const isAdmin = profilesByUser.some(
					(userRole) => userRole.roles.ds_name === "Administrador",
				);

				const users = await prisma.users.findMany({
					where: isAdmin
						? undefined
						: {
								cd_id: userId,
							},
					select: {
						cd_id: true,
						ds_name: true,
						ds_email: true,
						ds_avatar_url: true,
						ds_role_description: true,
						dt_last_login: true,
					},
				});

				const usersFormatted = users.map((user) => {
					return {
						id: user.cd_id,
						name: user.ds_name,
						email: user.ds_email,
						avatarUrl: user.ds_avatar_url ?? null,
						roleDescription: user.ds_role_description,
						lastLogin: user.dt_last_login?.toISOString() ?? null,
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
