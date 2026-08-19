import { env } from "@/env";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

interface ZabbixLoginData {
	jsonrpc: string;
	result: string;
	id: number;
}

export interface ZabbixItem {
	itemid: string;
	hostid: string;
	name: string;
	key_: string;
	lastvalue: string;
}

export interface ZabbixItemsResponse {
	jsonrpc: string;
	result: ZabbixItem[];
	id: number;
}

export interface ServerMetrics {
	hostId: string;
	name: string;
	up: boolean;
	cpu: number;
	memory: number;
	disk: number;
	uptime: number;
}

// 🔥 TIPAGEM CORRETA DO SUMMARY
type SeverityKey =
	| "disaster"
	| "high"
	| "average"
	| "warning"
	| "information"
	| "none";

interface IncidentSummary {
	disaster: number;
	high: number;
	average: number;
	warning: number;
	information: number;
	none: number;
}

export const getProblemsRoute = async (app: FastifyInstance) => {
	app.withTypeProvider<ZodTypeProvider>().post(
		"/problems",
		{
			schema: {
				body: z.object({
					hostIds: z.array(z.number()),
				}),
			},
		},
		async (request, reply) => {
			const { hostIds } = request.body;

			// =========================
			// LOGIN ZABBIX
			// =========================
			const loginResponse = await fetch(`${env.ZABBIX_URL}/api_jsonrpc.php`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "user.login",
					params: {
						username: env.ZABBIX_USERNAME,
						password: env.ZABBIX_PASSWORD,
					},
					id: 1,
				}),
			});

			const loginData = (await loginResponse.json()) as ZabbixLoginData;
			const token = loginData.result;

			// =========================
			// GET PROBLEMS
			// =========================
			const itemsResponse = await fetch(`${env.ZABBIX_URL}/api_jsonrpc.php`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "problem.get",
					params: {
						hostids: hostIds,
						output: "extend",
					},
					id: 1,
				}),
			});

			const problemsData: any = await itemsResponse.json();

			// =========================
			// SUMMARY TIPADO
			// =========================
			const summary: IncidentSummary = {
				disaster: 0,
				high: 0,
				average: 0,
				warning: 0,
				information: 0,
				none: 0,
			};

			const severityMap: Record<number, SeverityKey> = {
				5: "disaster",
				4: "high",
				3: "average",
				2: "warning",
				1: "information",
				0: "none",
			};

			for (const problem of problemsData.result) {
				const severityNumber = Number(problem.severity);
				const key = severityMap[severityNumber];

				if (key) {
					summary[key]++;
				}
			}

			return reply.status(200).send({
				incidents: summary,
			});
		},
	);
};
