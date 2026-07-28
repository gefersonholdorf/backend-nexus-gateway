import { env } from "@/env";
import { Either, Service } from "../service";

interface LoginDataResponse {
    data: {
		account: string
		device_id: string
		ik_message: string,
		is_portal_port: boolean
		sid: string
		synotoken: string
	},
	success: boolean
}

interface LoginNasServiceRequest {
    account: string
    passwd: string
}

interface LoginNasServiceResponse {
	result: LoginDataResponse
}

export class LoginNasService implements Service<LoginNasServiceRequest, LoginNasServiceResponse> {
    constructor() {}

    async execute(serviceRequest: LoginNasServiceRequest): Promise<Either<Error, LoginNasServiceResponse>> {
        try {
            const url = `${env.NAS_URL}webapi/entry.cgi?api=SYNO.API.Auth&version=7&method=login&account=${serviceRequest.account}&passwd=${serviceRequest.passwd}&enable_syno_token=yes&session=Core&format=sid`
            
            const data = await fetch(url)

            const result = await data.json() as LoginDataResponse

            return {
                right: {
                    result
                }
            }
        } catch (error) {
            console.error(error)
            return {
                left: new Error("Credentials invalid."),
            }
        }
    }
} 