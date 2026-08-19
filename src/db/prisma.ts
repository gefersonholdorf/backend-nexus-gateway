import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "@/env";

const adapter = new PrismaMariaDb({
	host: env.DATABASE_HOST,
	port: env.DATABASE_PORT,
	user: env.DATABASE_USER,
	password: env.DATABASE_PASSWORD,
	database: env.DATABASE_NAME,
	connectionLimit: 5,
});
export const prisma = new PrismaClient({
	adapter,
	log: ["error", "info", "warn"],
});
