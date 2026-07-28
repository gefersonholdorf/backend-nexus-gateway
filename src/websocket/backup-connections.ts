import type { WebSocket } from "ws";

interface ConnectedClient {
    socket: WebSocket;
    id: string;
}

const clients = new Map<string, ConnectedClient>();

export const backupWebSocketManager = {
    add(clientId: string, socket: WebSocket) {
        clients.set(clientId, { socket, id: clientId });
        console.log(`Cliente ${clientId} conectado. Total: ${clients.size}`);
    },

    remove(clientId: string) {
        clients.delete(clientId);
        console.log(`Cliente ${clientId} desconectado. Total: ${clients.size}`);
    },

    broadcast(message: unknown) {
        const data = JSON.stringify(message);
        for (const client of clients.values()) {
            if (client.socket.readyState === 1) { // OPEN
                client.socket.send(data);
            }
        }
    },

    sendTo(clientId: string, message: unknown) {
        const client = clients.get(clientId);
        if (client && client.socket.readyState === 1) {
            client.socket.send(JSON.stringify(message));
        }
    }
};