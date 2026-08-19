import "@fastify/jwt";

declare module "@fastify/jwt" {
	interface FastifyJWT {
		user: {
			sub: string;
			email: string;
			name: string;
			vpnName: string;
			idGLPI: string;
			roles: string[];
			permissions: string[];
		};
	}
}
