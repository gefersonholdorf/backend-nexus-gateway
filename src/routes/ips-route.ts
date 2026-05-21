import { env } from "@/env";
import { generateNetworkMap } from "@/services/generate-network-map-service";
import type { DockerContainer, DockerNetwork } from "@/types/docker";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export const ipsRoute = async(app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/ips/server/:idServer/network/:idNetwork", {
        schema: {
            params: z.object({
                idServer: z.coerce.string(),
                idNetwork: z.coerce.string()
            })
        }
    },async (request, reply) => {
        const { idServer } = request.params;
        const response = await fetch(`${env.PORTAINER_URL}/api/endpoints/${idServer}/docker/containers/json?all=true`,
            {
                headers: {
                    "X-API-Key": `${env.PORTAINER_TOKEN}`
                }
            }
        );

        const data: DockerContainer[] = await response.json() as DockerContainer[];

        const { idNetwork } = request.params;

        const responseNetwork = await fetch(`${env.PORTAINER_URL}/api/endpoints/${idServer}/docker/networks/${idNetwork}`,
            {
                headers: {
                    "X-API-Key": `${env.PORTAINER_TOKEN}`
                }
            }
        );

        const dataNetwork: DockerNetwork = await responseNetwork.json() as DockerNetwork;

        const subnet = dataNetwork?.IPAM?.Config?.[0]?.Subnet ?? 'unknown';

        const subnetParts = subnet.split('/');
        const networkBase = subnetParts[0].split('.').slice(0, 3).join('.');

        const networks = data.map(container => {
            return {
                ip: String(container.NetworkSettings.Networks.docker_f_net.IPAddress),
                used: true,
                service: container.Labels["com.docker.compose.service"] || null,
                state: container.State || null
            }
        }).flat();

        const fullMap = generateNetworkMap(
            networkBase,
            networks
        )

        return {
            network: subnet,
            fullMap
        }
    }  )
}