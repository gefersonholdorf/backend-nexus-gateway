import { env } from "@/env";
import { loginGlpi } from "@/integrations/glpi/login-glpi";
import { SLAResult } from "@/integrations/glpi/sla/sla-types";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { Ticket } from "./get-tickets-route";
import { BusinessCalendarService } from "@/integrations/glpi/sla/business-calendar-service";
import { SLAService } from "@/integrations/glpi/sla/sla-service";
import { calculateTicketSLA } from "@/integrations/glpi/sla/calculate-sla";

interface SLASummary {
    percentage: number;
    total: number;
    completed: number;
    met: number;
    breached: number;
    pending: number;
}

interface TicketWithSLA extends SearchTicketItem {
    sla: {
        atendimento: SLAResult;
        resolucao: SLAResult;
    };
}

function calculateSLASummary(
    tickets: TicketWithSLA[],
    type: "atendimento" | "resolucao"
): SLASummary {

    let total = 0;
    let completed = 0;
    let met = 0;
    let breached = 0;
    let pending = 0;

    for (const ticket of tickets) {

        const sla = ticket.sla?.[type];

        if (!sla) {
            continue;
        }

        total++;

        if (sla.completed) {
            completed++;

            if (sla.expired) {
                breached++;
            } else {
                met++;
            }

            continue;
        }

        if (sla.expired) {
            breached++;
        } else {
            pending++;
        }
    }

    const evaluated = met + breached;

    const percentage =
        evaluated > 0
            ? Math.round((met / evaluated) * 1000) / 10
            : 0;

    return {
        percentage,
        total,
        completed,
        met,
        breached,
        pending,
    };
}

export const TicketStatus = {
    1: "Novo",
    2: "Em atendimento",
    3: "Planejado",
    4: "Pendente",
    5: "Solucionado",
    6: "Fechado",
    10: "Aprovação",
} as const;

export const TicketPriority = {
    1: "Muito baixa",
    2: "Baixa",
    3: "Média",
    4: "Alta",
    5: "Muito alta",
    6: "Major",
} as const;

export interface SearchTicketItem {
    /** Título */
    "1": string;
    /** ID do ticket */
    "2": number;
    /** ID do solicitante */
    "4": string | null;
    /** ID do técnico */
    "5": string | null;
    /** Categoria */
    "7": string | null;
    /** Prioridade */
    "10": number;
    /** Status */
    "12": number;
    /** Data de abertura */
    "15": string;
    /** Última atualização */
    "19": string;
    /** Data de fechamento */
    "151": string | null;
    /** Data limite (SLA) */
    "158": string | null;
    /** Campo personalizado */
    "450": string | null;
}

export interface SearchTicketResponse {
    totalcount: number;
    count: number;
    sort: number[];
    order: ("ASC" | "DESC")[];
    data: SearchTicketItem[];
    "content-range": string;
}

export const getTicketsSummaryRoute = async (app: FastifyInstance) => {
    const businessCalendar = new BusinessCalendarService({
        startHour: 8,
        endHour: 18,
    });

    const slaService = new SLAService(
        businessCalendar
    );
    app.withTypeProvider<ZodTypeProvider>().get("/tickets/summary", {
        preHandler: [authenticate],
        schema: {
            title: "Get Tickets Summary",
            description: "Get Tickets Summary",
            tags: ["GLPI"],
            response: {
                200: z.object({
                    summary: z.object({
                        total: z.number(),
                        new: z.number(),
                        inProgress: z.number(),
                        planned: z.number(),
                        pending: z.number(),
                        solved: z.number(),
                        closed: z.number(),
                        approval: z.number(),
                        sla: z.object({
                            atendimento: z.object({
                                percentage: z.number(),

                                total: z.number(),
                                completed: z.number(),
                                met: z.number(),
                                breached: z.number(),
                                pending: z.number(),
                            }),

                            resolucao: z.object({
                                percentage: z.number(),

                                total: z.number(),
                                completed: z.number(),
                                met: z.number(),
                                breached: z.number(),
                                pending: z.number(),
                            }),
                        }),
                        alerts: z.object({
                            slaExpired: z.object({
                                count: z.number()
                            }),
                            withoutResponsible: z.object({
                                count: z.number()
                            }),
                            withoutUpdate: z.object({
                                count: z.number()
                            })
                        })
                    }),
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (_, reply) => {
        try {
            let slaExpiredCount = 0;
            let withoutResponsibleCount = 0;
            let withoutUpdateCount = 0;
            const loginGLPI = await loginGlpi()

            const params = new URLSearchParams();

            params.set("range", `0-2000`);

            const response = await fetch(`${env.GLPI_URL}/search/Ticket?${params}`,
                {
                    headers: {
                        "Session-Token": loginGLPI.session_token,
                        "App-Token": env.GLPI_APP_TOKEN,
                    }
                }
            );

            const searchTickets = await response.json() as SearchTicketResponse;

            const summary = {
                total: searchTickets.totalcount,
                new: 0,
                inProgress: 0,
                planned: 0,
                pending: 0,
                solved: 0,
                closed: 0,
                approval: 0,
            };

            for (const ticket of searchTickets.data) {
                switch (ticket["12"]) {
                    case 1:
                        summary.new++;
                        break;

                    case 2:
                        summary.inProgress++;
                        break;

                    case 3:
                        summary.planned++;
                        break;

                    case 4:
                        summary.pending++;
                        break;

                    case 5:
                        summary.solved++;
                        break;

                    case 6:
                        summary.closed++;
                        break;

                    case 10:
                        summary.approval++;
                        break;
                }
            }

            const tickets: TicketWithSLA[] = await Promise.all(
                searchTickets.data.map(async (ticket) => {

                    const response = await fetch(
                        `${env.GLPI_URL}/Ticket/${ticket["2"]}`,
                        {
                            headers: {
                                "Session-Token": loginGLPI.session_token,
                                "App-Token": env.GLPI_APP_TOKEN,
                            },
                        }
                    );

                    const ticketGLPI = await response.json() as Ticket;

                    const ticketUsersResponse = await fetch(
                        `${env.GLPI_URL}/Ticket/${ticketGLPI.id}/Ticket_User`,
                        {
                            headers: {
                                "Session-Token": loginGLPI.session_token,
                                "App-Token": env.GLPI_APP_TOKEN,
                            },
                        }
                    );

                    const ticketUsers = await ticketUsersResponse.json() as {
                        type: number;
                    }[];

                    const sla = calculateTicketSLA(
                        ticketGLPI,
                        businessCalendar,
                        slaService
                    );

                    const activeStatus = [
                        1,
                        2,
                        3,
                        10
                    ];


                    if (
                        activeStatus.includes(ticketGLPI.status)
                        &&
                        (
                            sla.atendimento.expired ||
                            sla.resolucao.expired
                        )
                    ) {
                        slaExpiredCount++;
                    }

                    const technicians =
                        ticketUsers.filter(
                            user => user.type === 2
                        );


                    if (
                        activeStatus.includes(ticketGLPI.status)
                        &&
                        technicians.length === 0
                    ) {
                        withoutResponsibleCount++;
                    }

                    const lastUpdate =
                        new Date(ticketGLPI.date_mod);


                    const now = new Date();


                    const diffHours =
                        (now.getTime() - lastUpdate.getTime())
                        /
                        (1000 * 60 * 60);


                    if (
                        activeStatus.includes(ticketGLPI.status)
                        &&
                        diffHours > 24
                    ) {
                        withoutUpdateCount++;
                    }

                    return {
                        ...ticket,
                        sla
                    };
                })
            );


            const sla = {
                atendimento: calculateSLASummary(
                    tickets,
                    "atendimento"
                ),

                resolucao: calculateSLASummary(
                    tickets,
                    "resolucao"
                ),
            };


            return reply.send({
                summary: {
                    ...summary,
                    sla,
                    alerts: {
                        slaExpired: {
                            count: slaExpiredCount
                        },

                        withoutResponsible: {
                            count: withoutResponsibleCount
                        },

                        withoutUpdate: {
                            count: withoutUpdateCount
                        }
                    }
                }
            });
        } catch (error) {
            console.error(error);

            return reply.status(500).send({
                message: "Internal server error",
            });
        }
    })
}