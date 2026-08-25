// import { prisma } from "@/db/prisma";
// import { authenticate } from "@/middlewares/authenticate";
// import { hasPermission } from "@/middlewares/has-permission";
// import type { FastifyInstance } from "fastify";
// import { ZodTypeProvider } from "fastify-type-provider-zod";
// import z from "zod";

// export const getSummaryDocumentsRoute = async (app: FastifyInstance) => {
//     app.withTypeProvider<ZodTypeProvider>().get(
//         "/documents/summary",
//         {
//             preHandler: [authenticate],
//             schema: {
//                 title: "Get Summary Document",
//                 description: "Get Summary a Document.",
//                 tags: ["Documents"],
//                 querystring: z.object({
//                     category: z.string().optional(),
//                     status: z.string().optional(),
//                     text: z.string().optional(),
//                     profile: z.string().optional(),
//                 }),
//                 response: {
//                     200: z.object({
//                         summary: z.object({
//                             total: z.number(),
//                             present: z.number(),
//                             revision: z.number(),
//                             progress: z.number(),
//                             pending: z.number()
//                         })
//                     }),
//                     404: z.object({
//                         message: z.string(),
//                     }),
//                     500: z.object({
//                         message: z.string()
//                     })
//                 },
//             },
//         },
//         async (request, reply) => {
//             const { category, profile, status, text } = request.query;
//             const { roles } = request.user

//             const where = {
//                 ...(category && {
//                     ds_category: category,
//                 }),

//                 ...(status && {
//                     ds_status: status,
//                 }),

//                 ...(profile && {
//                     documents_roles: {
//                         some: {
//                             cd_role_id: Number(profile),
//                         },
//                     },
//                 }),

//                 ...(text && {
//                     OR: [
//                         {
//                             ds_code: {
//                                 contains: text,
//                             },
//                         },
//                         {
//                             ds_title: {
//                                 contains: text,
//                             },
//                         },
//                     ],
//                 }),
//             };

//             try {
//                 const [documents, total] = await Promise.all([
//                     prisma.documents.findMany({
//                         where,
//                     }),
//                     prisma.documents.count({
//                         where,
//                     }),
//                 ]);

//                 const summary = {
//                     total,
//                     present: documents.filter((item) => item.ds_status === 'Vigente').length,
//                     revision: documents.filter((item) => item.ds_status === 'Em Revisão').length,
//                     progress: documents.filter((item) => item.ds_status === 'Em Andamento').length,
//                     pending: documents.filter((item) => item.ds_status === 'Pendente').length,
//                 }

//                 return reply.status(200).send({
//                     summary
//                 });

//             } catch (error) {
//                 console.error(error)
//                 return reply.status(500).send({
//                     message: "Internal server error."
//                 })
//             }
//         },
//     );
// };
