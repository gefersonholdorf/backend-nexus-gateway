import { FastifyReply, FastifyRequest } from "fastify";

export function hasPermission(permission: string) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		if (!request.user.permissions.includes(permission)) {
			return reply.status(403).send({
				message: "Forbidden",
			});
		}
	};
}
