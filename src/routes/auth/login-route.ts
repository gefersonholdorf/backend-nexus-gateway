import { prisma } from "@/db/prisma";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import bcrypt from "bcrypt";
import { hasPermission } from "@/middlewares/has-permission";

export const loginRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/login",
		{
			schema: {
				title: "Login",
				description: "Log in to the system.",
				tags: ["Auth"],
				body: z.object({
					email: z.email(),
					password: z.string(),
				}),
				response: {
					200: z.object({
						token: z.string(),
						user: z.object({
							email: z.email(),
							name: z.string(),
							roles: z.array(z.string()),
							permissions: z.array(z.string()),
						}),
					}),
					401: z.object({
						message: z.string(),
					}),
					500: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { email, password } = request.body;
			try {
				const user = await prisma.users.findUnique({
					where: {
						ds_email: email,
					},
					include: {
						user_roles: {
							include: {
								roles: {
									include: {
										role_permissions: {
											include: {
												permissions: true,
											},
										},
									},
								},
							},
						},
					},
				});

				if (!user) {
					return reply.status(401).send({
						message: "E-mail or password invalid.",
					});
				}

				const passwordMatch = await bcrypt.compare(password, user.ds_password);

				if (!passwordMatch) {
					return reply.status(401).send({
						message: "E-mail or password invalid.",
					});
				}

				const roles = user.user_roles.map((userRole) => userRole.roles.ds_name);

				const permissions = [
					...new Set(
						user.user_roles.flatMap((userRole) =>
							userRole.roles.role_permissions.map(
								(rolePermission) => rolePermission.permissions.ds_key,
							),
						),
					),
				];

				const token = await reply.jwtSign(
					{
						email: user.ds_email,
						name: user.ds_name,

						roles,
						permissions,
					},
					{
						sub: String(user.cd_id),
						expiresIn: "1d",
					},
				);

				return reply.status(200).send({
					token,
					user: {
						email: user.ds_email,
						name: user.ds_name,
						roles,
						permissions,
					},
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
