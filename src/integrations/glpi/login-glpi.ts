import { env } from "@/env";

interface LoginResponse {
    session_token: string
}

export const loginGlpi = async () => {
    try {
        const loginResponse = await fetch(`${env.GLPI_URL}/initSession`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": env.GLPI_AUTHORIZATION,
                    "App-Token": env.GLPI_APP_TOKEN
                }
            });

            const loginData = await loginResponse.json() as LoginResponse;

            return loginData
    } catch (error) {
        console.error(error);
        throw new Error("Failed to login to GLPI");
    }
}