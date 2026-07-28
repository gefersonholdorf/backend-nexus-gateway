import { FastifyInstance } from "fastify";
import { backupWebSocketManager } from "@/websocket/backup-connections";

export const backupWebSocketRoute = async (app: FastifyInstance) => {
    app.get("/ws/backups", { websocket: true }, (socket) => {
        const clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        console.log("Novo WS");

        backupWebSocketManager.add(clientId, socket);

        socket.on("error", (err) => {
            console.error("WS Error", err);
        });

        socket.on("close", (code, reason) => {
            console.log("Close", {
                code,
                reason: reason.toString(),
            });

            backupWebSocketManager.remove(clientId);
        });
    });
};