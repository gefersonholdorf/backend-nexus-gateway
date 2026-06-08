import { env } from "@/env";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

interface ZabbixLoginData {
  jsonrpc: string
  result: string
  id: number
}

interface ZabbixProblem {
  eventid: string
  severity: string
  clock: string
}

interface ZabbixProblemsResponse {
  jsonrpc: string
  result: ZabbixProblem[]
  id: number
}

export const getProblemsTimelineRoute = async (
  app: FastifyInstance
) => {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/problems/timeline",
    {
      schema: {
        body: z.object({
          hostIds: z.array(z.number()),
          days: z.number().min(1).max(365).default(30),
        }),
      },
    },
    async (request, reply) => {
      const { hostIds, days } = request.body

      const loginResponse = await fetch(
        `${env.ZABBIX_URL}/api_jsonrpc.php`,
        {
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
        }
      )

      const loginData =
        (await loginResponse.json()) as ZabbixLoginData

      const token = loginData.result

      const endDate = new Date()
      const startDate = new Date()

      startDate.setDate(startDate.getDate() - days)

      const timeFrom = Math.floor(
        startDate.getTime() / 1000
      )

      const timeTill = Math.floor(
        endDate.getTime() / 1000
      )

      const problemsResponse = await fetch(
        `${env.ZABBIX_URL}/api_jsonrpc.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "event.get",
            params: {
                source: 0,
                object: 0,
                value: 1,
                hostids: hostIds,
                time_from: timeFrom,
                time_till: timeTill,
                output: [
                "eventid",
                "severity",
                "clock"
                ]
            },
            id: 1,
            }),
        }
      )

      const problemsData =
        (await problemsResponse.json()) as ZabbixProblemsResponse

      const timeline: Record<
        string,
        {
          date: string
          disaster: number
          high: number
          average: number
          warning: number
          information: number
        }
      > = {}

      for (
        let i = 0;
        i <= days;
        i++
      ) {
        const date = new Date(startDate)

        date.setDate(startDate.getDate() + i)

        const key = date.toISOString().split("T")[0]

        timeline[key] = {
          date: key,
          disaster: 0,
          high: 0,
          average: 0,
          warning: 0,
          information: 0,
        }
      }

      for (const problem of problemsData.result) {
        const dateKey = new Date(
          Number(problem.clock) * 1000
        )
          .toISOString()
          .split("T")[0]

        const day = timeline[dateKey]

        if (!day) continue

        switch (Number(problem.severity)) {
          case 5:
            day.disaster++
            break

          case 4:
            day.high++
            break

          case 3:
            day.average++
            break

          case 2:
            day.warning++
            break

          case 1:
            day.information++
            break
        }
      }

      return reply.status(200).send({
        period: {
          days,
          startDate,
          endDate,
        },
        timeline: Object.values(timeline),
      })
    }
  )
}