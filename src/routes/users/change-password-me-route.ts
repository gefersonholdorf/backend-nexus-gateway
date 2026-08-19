
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
					currentPassword: z.string(),
					newPassword: z.string(),
				}),
				response: {
					200: z.object({
						message: z.string(),
					}),
					404: z.object({
						message: z.string()
					}),
					401: z.object({
						message: z.string()
					}),
					500: z.object({
						message: z.string()
					})
				},
			},
		},
		async (request, reply) => {
			const { newPassword, currentPassword } = request.body;
			const { sub } = request.user;

			const user = await prisma.users.findUnique({
				where: {
					cd_id: Number(sub)
				}
			})

			if(!user) {
				return reply.status(404).send({
					message: "User not found."
				})
			}

			const isCurrentPasswordValid = await bcrypt.compareSync(currentPassword, user.ds_password)

			if(!isCurrentPasswordValid) {
				return reply.status(401).send({
					message: "Current password is incorrect."
				})
			}

			const hash = await bcrypt.hash(newPassword, 10);

			await prisma.users.update({
				where: {
					cd_id: user.cd_id,
				},
				data: {
					ds_password: hash,
				},
			});

			return reply.status(200).send({
				message: "User password updated successfully.",
			});
		},
	);
};
