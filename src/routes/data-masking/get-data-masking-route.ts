import { env } from "@/env";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

const executionStatusSchema = z.enum([
  "SUCCESS",
  "ERROR",
  "PARTIAL_ERROR",
]);

const databaseTypeSchema = z.enum([
  "TENANT",
  "MASTER",
]);

const executionErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const tableExecutionSchema = z.object({
  name: z.string(),
  status: executionStatusSchema,
  recordsProcessed: z.number(),
  dynamic: z.boolean().optional(),
  columnsNulled: z.number().optional(),
  columnsNotChanged: z.number().optional(),
  error: executionErrorSchema.nullable(),
});

const databaseSummarySchema = z.object({
  tablesExpected: z.number(),
  tablesProcessed: z.number(),
  tablesSuccess: z.number(),
  tablesError: z.number(),
  recordsProcessed: z.number(),
});

const databaseExecutionSchema = z.object({
  name: z.string(),
  type: databaseTypeSchema,
  startedAt: z.string(),
  finishedAt: z.string(),
  status: executionStatusSchema,
  summary: databaseSummarySchema,
  tables: z.array(tableExecutionSchema),
  error: executionErrorSchema.nullable(),
});

const dataMaskingResponseSchema = z.object({
  execution: z.object({
    executionId: z.string(),
    environment: z.string(),
    executionMode: z.string(),
    isOfficialExecution: z.boolean(),
    dataLoad: z.object({
      sourceEnvironment: z.string(),
      targetEnvironment: z.string(),
    }),
    startedAt: z.string(),
    finishedAt: z.string(),
    status: executionStatusSchema,
    userAccessControl: z.object({
      prefix: z.string(),
      usersFound: z.number(),
      usersLocked: z.number(),
      usersUnlocked: z.number(),
      lockStatus: executionStatusSchema,
      unlockStatus: executionStatusSchema,
    }),
    databasesExpected: z.number(),
    databasesProcessed: z.number(),
    databasesSuccess: z.number(),
    databasesPartialError: z.number(),
    databasesError: z.number(),
  }),
  databases: z.array(databaseExecutionSchema),
});

export type DataMaskingResponse = z.infer<typeof dataMaskingResponseSchema>;

export const getDataMaskingRoute = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().get("/data-masking/:id", {
    preHandler: [authenticate],
    schema: {
      title: "Get Data Maskings",
      description: "Get Data Maskings",
      tags: ["Data Maskings"],
      params: z.object({
        id: z.string()
      }),
      response: {
        200: dataMaskingResponseSchema,
        404: z.object({
          message: z.string()
        }),
        500: z.object({
          message: z.string()
        })
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params
      const response = await fetch(`${env.STORAGE}/diamante-mask-db/${id}`);

      if (!response.ok) {
        return reply.status(404).send({
          message: "File not found."
        })
      }

      const data = await response.json() as DataMaskingResponse;

      return reply.status(200).send(data)
    } catch (error) {
      console.error(error)
      return reply.status(500).send({
        message: "Internal server error."
      })
    }
  })
}