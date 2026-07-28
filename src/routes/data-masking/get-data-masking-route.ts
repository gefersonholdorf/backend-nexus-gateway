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
    app.withTypeProvider<ZodTypeProvider>().get("/data-masking", {
        schema: {
            title: "Get Data Maskings",
            description: "Get Data Maskings",
            tags: ["Data Maskings"],
            response: {
                200: z.array(dataMaskingResponseSchema),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (_, reply) => {
        try {
            const response1 = await fetch(
                "https://api2.lusati.com.br/repositorio/nexus/diamante-mask-db/anonimizacao-2026-07-28T05-02-11-627Z.json"
            );

            const response2 = await fetch(
                "https://api2.lusati.com.br/repositorio/nexus/diamante-mask-db/anonimizacao-2026-07-27T12-37-02-511Z.json"
            );

            const response3 = await fetch(
                "https://api2.lusati.com.br/repositorio/nexus/diamante-mask-db/anonimizacao-2026-07-27T12-37-02-511Z.json"
            );

            if (!response1.ok) {
                throw new Error("Erro ao buscar arquivos");
            }

            const data1 = await response1.json() as DataMaskingResponse;
            const data2 = await response2.json() as DataMaskingResponse;
            const data3 = await response3.json() as DataMaskingResponse;

            return reply.status(200).send([data1, data2, data3])
        } catch (error) {
            console.error(error)
            return reply.status(500).send({
                message: "Internal server error."
            })
        }
    })
}