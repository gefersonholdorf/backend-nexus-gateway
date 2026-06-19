import { prisma } from "@/db/prisma";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import bcrypt from "bcrypt";
import { authenticate } from "@/middlewares/authenticate";
import { hasPermission } from "@/middlewares/has-permission";

export const createUserRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/users",
		{
			preHandler: [authenticate, hasPermission("users.create")],
			schema: {
				title: "Create User",
				description: "Create a new user.",
				tags: ["Users"],
				body: z.object({
					name: z.string(),
					email: z.email(),
					password: z.string(),
					flActive: z.boolean(),
					rolesId: z.array(z.coerce.number()),
				}),
				response: {
					201: z.object({
						userId: z.number(),
					}),
					404: z.object({
						message: z.string(),
					}),
				},
			},
		},
		async (request, reply) => {
			const { name, email, password, flActive, rolesId } = request.body;

			const hash = await bcrypt.hash(password, 10);

			for (const role of rolesId) {
				const existingRole = await prisma.roles.findUnique({
					where: {
						cd_id: role,
					},
				});

				if (!existingRole) {
					return reply.status(404).send({
						message: "Role not found.",
					});
				}
			}

			const user = await prisma.$transaction(async (tx) => {
				const user = await tx.users.create({
					data: {
						ds_name: name,
						ds_email: email,
						ds_password: hash,
						fl_active: flActive ? 1 : 0,
						cd_id_glpi: "",
						ds_latitude: "",
						ds_longitude: "",
						ds_vpn_name: "",
					},
				});

				const data = rolesId.map((roleId) => ({
					cd_user: user.cd_id,
					cd_role: roleId,
				}));

				await tx.user_roles.createMany({
					data,
				});

				return user;
			});

			return reply.status(201).send({
				userId: user.cd_id,
			});
		},
	);
};
