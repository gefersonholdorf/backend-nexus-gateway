import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";

const clients = new Set<WebSocket>();

export async function websocketRoutes(app: FastifyInstance) {
    app.get("/ws", { websocket: true }, (socket) => {
        console.log("Cliente conectado");

        clients.add(socket);

        socket.on("close", () => {
            console.log("Cliente desconectado");
            clients.delete(socket);
        });

        socket.on("message", (message) => {
            console.log(message.toString());
        });
    });
}

export function broadcast(event: string, payload: unknown) {
    const message = JSON.stringify({
        event,
        payload,
    });

    clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}