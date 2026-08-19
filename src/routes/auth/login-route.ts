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
							roleDescription: z.string(),
							logo: z.string().nullable(),
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
						vpnName: user.ds_vpn_name,
						idGLPI: String(user.cd_id_glpi),
						permissions,
					},
					{
						sub: String(user.cd_id),
						expiresIn: "1d",
					},
				);

				await prisma.users.update({
					where: {
						cd_id: user.cd_id
					},
					data: {
						dt_last_login: new Date()
					}
				})

				return reply.status(200).send({
					token,
					user: {
						email: user.ds_email,
						name: user.ds_name,
						logo: user.ds_avatar_url,
						roleDescription: user.ds_role_description,
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
