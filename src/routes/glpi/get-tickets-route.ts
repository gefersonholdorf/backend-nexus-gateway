import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { loginGlpi } from "@/integrations/glpi/login-glpi";
import { BusinessCalendarService } from "@/integrations/glpi/sla/business-calendar-service";
import { SLAService } from "@/integrations/glpi/sla/sla-service";
import { SLA_RULES } from "@/integrations/glpi/sla/sla-types";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

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

export const TicketStatus = {
    1: "Novo",
    2: "Em atendimento",
    3: "Planejado",
    4: "Pendente",
    5: "Solucionado",
    6: "Fechado",
    10: "Aprovação",
} as const;

export const TicketType = {
    1: "Incidente",
    2: "Requisição",
} as const;

export const TicketUrgency = {
    1: "Muito baixa",
    2: "Baixa",
    3: "Média",
    4: "Alta",
    5: "Muito alta",
} as const;

export const TicketImpact = {
    1: "Muito baixo",
    2: "Baixo",
    3: "Médio",
    4: "Alto",
    5: "Muito alto",
} as const;

export const TicketPriority = {
    1: "Muito baixa",
    2: "Baixa",
    3: "Média",
    4: "Alta",
    5: "Muito alta",
    6: "Major",
} as const;

export interface TicketLink {
    rel: string;
    href: string;
}

export interface Ticket {
    id: number;
    entities_id: number;
    name: string;
    content: string;
    date: string;
    date_creation: string;
    date_mod: string;
    closedate: string | null;
    solvedate: string | null;
    takeintoaccountdate: string | null;
    users_id_lastupdater: number;
    users_id_recipient: number;
    requesttypes_id: number;
    urgency: number;
    impact: number;
    priority: number;
    itilcategories_id: number;
    type: number;
    status: number;
    global_validation: number;
    slas_id_ttr: number;
    slas_id_tto: number;
    slalevels_id_ttr: number;
    time_to_resolve: string | null;
    time_to_own: string | null;
    begin_waiting_date: string | null;
    sla_waiting_duration: number;
    ola_waiting_duration: number;
    olas_id_tto: number;
    olas_id_ttr: number;
    olalevels_id_ttr: number;
    ola_tto_begin_date: string | null;
    ola_ttr_begin_date: string | null;
    internal_time_to_resolve: string | null;
    internal_time_to_own: string | null;
    waiting_duration: number;
    close_delay_stat: number;
    solve_delay_stat: number;
    takeintoaccount_delay_stat: number;
    actiontime: number;
    is_deleted: number;
    locations_id: number;
    tickettemplates_id: number;
    externalid: string | null;
    links: TicketLink[];

}

interface TicketResponseFullDetails {
    id: number;
    name: string
    date: string
    date_mod: string
    closedate: string | null
    solvedate: string | null
    requester: string
    responsibles: {
        id: number
        name: string
        url: string | null
        role: string | null
    }[]
    urgency: string
    impact: string
    priority: string
    category: string | null
    type: string
    status: string
    time_to_own: string | null
    time_to_resolve: string | null
    takeintoaccountdate: string | null
    externalid: string
    sla: {
        atendimento: {
            title: "Atendimento" | "Resolução"
            label: string
            percentageValue:number
            percentage:number
            color: "green" | "yellow" | "orange" | "red"
            expired: boolean
            completed: boolean
            startDate: Date
            dueDate: Date | null
            completedDate: Date | null,
            remainingSeconds:number
            elapsedSeconds:number
            totalSeconds:number
        },
        resolucao: {
            title: "Atendimento" | "Resolução"
            label: string
            percentageValue:number
            percentage:number
            color: "green" | "yellow" | "orange" | "red"
            expired: boolean
            completed: boolean
            startDate: Date
            dueDate: Date | null
            completedDate: Date | null
            remainingSeconds:number
            elapsedSeconds:number
            totalSeconds:number
        },
    }
}

interface TicketUser {
    id: number;
    tickets_id: number;
    users_id: number;
    type: 1 | 2 | 3;
    use_notification: number;
    alternative_email: string;
}

const TicketResponseFullDetailsSchema = z.object({
    id: z.number(),
    name: z.string(),

    date: z.string(),
    date_mod: z.string(),

    closedate: z.string().nullable(),
    solvedate: z.string().nullable(),

    requester: z.string(),

    responsibles: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            url: z.string().nullable(),
            role: z.string().nullable()
        })
    ),

    urgency: z.string(),
    impact: z.string(),
    priority: z.string(),

    category: z.string().nullable(),

    type: z.string(),
    status: z.string(),

    time_to_own: z.string().nullable(),
    time_to_resolve: z.string().nullable(),
    takeintoaccountdate: z.string().nullable(),
    externalid: z.string(),
    sla: z.object({
        atendimento: z.object({
            title: z.enum(["Atendimento", "Resolução"]),
            label: z.string(),

            percentageValue: z.number(),
            percentage: z.number(),

            color: z.enum([
                "green",
                "yellow",
                "orange",
                "red"
            ]),

            expired: z.boolean(),
            completed: z.boolean(),

            startDate: z.coerce.date(),
            dueDate: z.coerce.date().nullable(),
            completedDate: z.coerce.date().nullable(),

            remainingSeconds: z.number(),
            elapsedSeconds: z.number(),
            totalSeconds: z.number(),
        }),

        resolucao: z.object({
            title: z.enum(["Atendimento", "Resolução"]),
            label: z.string(),

            percentageValue: z.number(),
            percentage: z.number(),

            color: z.enum([
                "green",
                "yellow",
                "orange",
                "red"
            ]),

            expired: z.boolean(),
            completed: z.boolean(),

            startDate: z.coerce.date(),
            dueDate: z.coerce.date().nullable(),
            completedDate: z.coerce.date().nullable(),

            remainingSeconds: z.number(),
            elapsedSeconds: z.number(),
            totalSeconds: z.number(),
        }),
    })
});

export const getTicketsRoute = async (app: FastifyInstance) => {
    const businessCalendar = new BusinessCalendarService({
        startHour: 8,
        endHour: 18,
    });

    const slaService = new SLAService(businessCalendar);

    app.withTypeProvider<ZodTypeProvider>().get("/tickets", {
        preHandler: [authenticate],
        schema: {
            title: "Get Tickets",
            description: "Get Tickets",
            tags: ["GLPI"],
            querystring: z.object({
                status: z.coerce.number(),
                page: z.coerce.number().default(1),
                limit: z.coerce.number().default(15),
            }),
            response: {
                200: z.object({
                    tickets: z.array(TicketResponseFullDetailsSchema),
                    pagination: z.object({
                        page: z.number(),
                        perPage: z.number(),
                        total: z.number(),
                        totalPages: z.number(),
                        hasNextPage: z.boolean(),
                        hasPreviousPage: z.boolean(),
                    })
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (request, reply) => {
        try {
            // const { idGLPI } = request.user
            const { status, page, limit } = request.query
            const loginGLPI = await loginGlpi()

            const params = new URLSearchParams();

            const start = (page - 1) * limit;
            const end = start + limit - 1;

            params.set("range", `${start}-${end}`);

            if (status && status !== 0) {
                params.set("criteria[0][field]", "12");
                params.set("criteria[0][searchtype]", "equals");
                params.set("criteria[0][value]", String(status));
            }

            params.set("sort", "19");
            params.set("order", "DESC");

            const response = await fetch(`${env.GLPI_URL}/search/Ticket?${params}`,
                {
                    headers: {
                        "Session-Token": loginGLPI.session_token,
                        "App-Token": env.GLPI_APP_TOKEN,
                    }
                }
            );

            const searchTickets = await response.json() as SearchTicketResponse;

            const total = searchTickets.totalcount;
            const totalPages = Math.ceil(total / limit);

            const pagination = {
                page,
                perPage: limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            };

            if (!searchTickets?.data || !Array.isArray(searchTickets.data)) {
                console.log("Nenhum ticket encontrado para o status:", status);
                return reply.send({
                    tickets: [],
                    pagination: {
                        page: 0,
                        perPage: 0,
                        total: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                });
            }

            const tickets: TicketResponseFullDetails[] = await Promise.all(
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

                    const rule = SLA_RULES[ticketGLPI.priority as keyof typeof SLA_RULES];

                    const atendimentoStartDate = new Date(ticketGLPI.date);

                    const atendimentoDueDate = rule ? businessCalendar.addBusinessHours(atendimentoStartDate, rule.atendimento) : null;

                    const atendimentoCompletedDate = ticketGLPI.takeintoaccountdate ? new Date(ticketGLPI.takeintoaccountdate) : null;

                    const atendimentoSLA =
                        slaService.calculate({
                            type: "Atendimento",

                            startDate:
                                atendimentoStartDate,

                            dueDate:
                                atendimentoDueDate,

                            completedDate:
                                atendimentoCompletedDate,

                            paused:
                                ticketGLPI.status === 4 &&
                                !ticketGLPI.takeintoaccountdate,
                        });

                    const resolucaoStartDate =
                        ticketGLPI.takeintoaccountdate
                            ? new Date(ticketGLPI.takeintoaccountdate)
                            : null;

                    const resolucaoCompletedDate =
                        ticketGLPI.solvedate
                            ? new Date(ticketGLPI.solvedate)
                            : null;

                    const resolucaoDueDate =
                        resolucaoStartDate && rule
                            ? businessCalendar.addBusinessHours(
                                resolucaoStartDate,
                                rule.resolucao
                            )
                            : null;

                    const resolucaoSLA = resolucaoStartDate
                        ? slaService.calculate({
                            type: "Resolução",

                            startDate:
                                resolucaoStartDate,

                            dueDate:
                                resolucaoDueDate,

                            completedDate:
                                resolucaoCompletedDate,

                            paused:
                                ticketGLPI.status === 4,
                        })
                        : {
                            title: "Resolução" as const,
                            label: "Aguardando Atendimento",

                            percentageValue: 0,
                            percentage: 0,

                            color: "yellow" as const,

                            expired: false,
                            completed: false,

                            startDate: atendimentoStartDate,
                            dueDate: null,
                            completedDate: null,

                            remainingSeconds: 0,
                            elapsedSeconds: 0,
                            totalSeconds: 0,
                        };

                    const categoryResponse = await fetch(
                        `${env.GLPI_URL}/ITILCategory/${ticketGLPI.itilcategories_id}`,
                        {
                            headers: {
                                "Session-Token": loginGLPI.session_token,
                                "App-Token": env.GLPI_APP_TOKEN,
                            },
                        }
                    );

                    const category = await categoryResponse.json() as { name: string };

                    const responseUser = await fetch(
                        `${env.GLPI_URL}/User/${ticketGLPI.users_id_recipient}`,
                        {
                            headers: {
                                "Session-Token": loginGLPI.session_token,
                                "App-Token": env.GLPI_APP_TOKEN,
                            },
                        }
                    );

                    const requester = await responseUser.json() as { firstname: string };

                    const responseUsersByTicket = await fetch(
                        `${env.GLPI_URL}/Ticket/${ticketGLPI.id}/Ticket_User`,
                        {
                            headers: {
                                "Session-Token": loginGLPI.session_token,
                                "App-Token": env.GLPI_APP_TOKEN,
                            },
                        }
                    );

                    const ticketUsers = await responseUsersByTicket.json() as TicketUser[];

                    const technicians = ticketUsers.filter(
                        user => user.type === 2
                    );

                    const responsibles = await Promise.all(
                        technicians.map(async (tech) => {
                            const response = await fetch(
                                `${env.GLPI_URL}/User/${tech.users_id}`,
                                {
                                    headers: {
                                        "Session-Token": loginGLPI.session_token,
                                        "App-Token": env.GLPI_APP_TOKEN,
                                    },
                                }
                            );

                            const user = await response.json() as {
                                id: number;
                                firstname: string;
                                realname: string;
                            };

                            const userNexus = await prisma.users.findFirst({
                                where: {
                                    cd_id_glpi: String(user.id)
                                }
                            });

                            return {
                                id: user.id,
                                name: `${user.firstname} ${user.realname}`.trim(),
                                url: userNexus ? userNexus?.ds_avatar_url || null : null,
                                role: userNexus?.ds_role_description ?? null
                            };
                        })
                    );

                    return {
                        id: ticketGLPI.id,
                        name: ticketGLPI.name,

                        date: ticketGLPI.date,
                        date_mod: ticketGLPI.date_mod,

                        closedate: ticketGLPI.closedate,
                        solvedate: ticketGLPI.solvedate,

                        requester: requester.firstname,

                        responsibles,

                        urgency: TicketUrgency[ticketGLPI.urgency as keyof typeof TicketUrgency],
                        impact: TicketImpact[ticketGLPI.impact as keyof typeof TicketImpact],
                        priority: TicketPriority[ticketGLPI.priority as keyof typeof TicketPriority],

                        category: category.name ?? null,

                        type: TicketType[ticketGLPI.type as keyof typeof TicketType],
                        status: TicketStatus[ticketGLPI.status as keyof typeof TicketStatus],

                        time_to_own: ticketGLPI.time_to_own,
                        time_to_resolve: ticketGLPI.time_to_resolve,
                        takeintoaccountdate: ticketGLPI.takeintoaccountdate,
                        externalid: ticketGLPI.externalid ?? "",
                        sla: {
                            atendimento: atendimentoSLA,
                            resolucao: resolucaoSLA,
                        },
                    };
                })
            );

            return reply.send({
                tickets,
                pagination
            });
        } catch (error) {
            console.error(error);

            return reply.status(500).send({
                message: "Internal server error",
            });
        }
    })
}