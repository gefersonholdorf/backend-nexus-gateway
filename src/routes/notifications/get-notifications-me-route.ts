import { prisma } from "@/db/prisma";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const getNotificationsMeRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/notifications/glpi/events/me", {
        preHandler: [authenticate],
        schema: {
            title: "Get notifications for GLPI events",
            description: "Get notifications for GLPI events",
            tags: ["Notifications"],
            response: {
                200: z.object({
                    notifications: z.array(z.object({
                        id: z.number(),
                        eventType: z.string(),
                        source: z.string(),
                        message: z.string(),
                        title: z.string(),
                        createdAt: z.string()
                    }))
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (request, reply) => {
        try {
            const { sub } = request.user

            const notifications = await prisma.notifications.findMany({
                where: {
                    cd_user_id: Number(sub),
                    dt_read_at: null
                },
                orderBy: {
                    cd_id: "desc",
                },
            });

            const notificationsFormatted = notifications.map(notification => ({
                id: notification.cd_id,
                eventType: notification.ds_event_type,
                source: notification.ds_source,
                message: notification.ds_message,
                title: notification.ds_title,
                createdAt: notification.dt_created_at?.toISOString() ?? ""
            }));

            return reply.status(200).send({ notifications: notificationsFormatted });
        } catch (error) {
            console.error("Internal server error:", error);
            return reply.status(500).send({ message: "Internal server error" });
        }
    })
}