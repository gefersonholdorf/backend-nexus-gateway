import { prisma } from "@/db/prisma";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const createPrivilegeRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/servers/create/privileges",
		{
			schema: {
				body: z.object({
					user: z.string(),
					server: z.string(),
					group: z.string(),
					duration: z.coerce.number(),
					justify: z.string(),
				}),
			},
		},
		async (request, reply) => {
			const { user, server, group, duration, justify } = request.body;

			const data = {
				ds_server: server,
				ds_justification: justify,
				ds_user: user,
				privilege: group,
				status: "ACTIVE",
				dt_start_at: new Date(),
				dt_expires_at: new Date(Date.now() + duration * 60 * 60 * 1000),
				dt_updated_at: new Date(),
			};

			await prisma.privileges.create({ data });

			return reply.status(200).send({
				status: true,
			});
		},
	);
};
