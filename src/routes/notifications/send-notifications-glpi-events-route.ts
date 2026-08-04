import { prisma } from "@/db/prisma";
import { broadcast } from "@/websocket/websocket";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const sendNotificationsGLPIEventsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().post("/notifications/glpi/events", {
        schema: {
            title: "Send notifications for GLPI events",
            description: "Send notifications for GLPI events",
            tags: ["Notifications"],
            body: z.looseObject({
                event: z.string(),
            }),
            response: {
                200: z.object({
                    result: z.string()
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (request, reply) => {
        try {
            const { event } = request.body

            switch (event) {
                case "glpi_new_problem":
                    await prisma.notifications.create({
                        data: {
                            ds_event_type: "glpi_new_problem",
                            ds_source: "GLPI",
                            ds_message: "Uma solicitação aguarda sua aprovação.",
                            ds_title: "Aprovação pendente",
                            cd_user_id: 1
                        }
                    })

                    broadcast("notification.created", {
                        title: "Aprovação pendente",
                        message: "Uma solicitação aguarda sua aprovação.",
                        source: "GLPI",
                        event: "glpi_new_problem"
                    });
                    break;

                case "ticket.create":
                    await prisma.notifications.create({
                        data: {
                            ds_event_type: "glpi_new_ticket",
                            ds_source: "GLPI",
                            ds_message: "Novo chamado aberto.",
                            ds_title: "Um novo chamado foi aberto no GLPI.",
                            cd_user_id: 1
                        }
                    })

                    broadcast("notification.created", {
                        title: "Novo chamado aberto.",
                        message: "Um novo chamado foi aberto no GLPI.",
                        source: "GLPI",
                        event: "glpi_new_ticket"
                    });
                    break;

                default:
                    break;
            }

            return reply.status(200).send({ result: "Notifications sent successfully" });
        } catch (error) {
            console.error("Error sending notifications for GLPI events:", error);
            return reply.status(500).send({ message: "Error sending notifications for GLPI events" });
        }
    })
}