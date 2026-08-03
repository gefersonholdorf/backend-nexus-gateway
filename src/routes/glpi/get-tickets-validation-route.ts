import { prisma } from "@/db/prisma";
import { env } from "@/env";
import { loginGlpi } from "@/integrations/glpi/login-glpi";
import { authenticate } from "@/middlewares/authenticate";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

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

export interface ValidationLink {
    rel: string | null;
    href: string;
}

export interface TicketValidation {
    id: number;
    itils_validationsteps_id: number;
    entities_id: number;
    users_id: number;
    tickets_id: number;
    users_id_validate: number;
    itilvalidationtemplates_id: number;
    itemtype_target: string;
    items_id_target: number;
    comment_submission: string;
    comment_validation: string | null;
    status: number;
    submission_date: string;
    validation_date: string | null;
    timeline_position: number;
    last_reminder_date: string | null;
    links: ValidationLink[];
}

export const getTicketsValidationsPendingsRoute = async (app: FastifyInstance) => {
    app.withTypeProvider<ZodTypeProvider>().get("/tickets/validation-pendings", {
        preHandler: [authenticate],
        schema: {
            title: "Get Tickets",
            description: "Get Tickets",
            tags: ["GLPI"],
            response: {
                200: z.object({
                    ticketsValidationsPendings: z.array(z.object({
                        id: z.number(),
                        ticketTitle: z.string(),
                        ticketDescription: z.string(),
                        itilcategories_id: z.number(),
                        time_to_own: z.string().nullable(),
                        requester: z.string(),
                        requesterId: z.number(),
                        requesterPathUrl: z.string().nullable(),
                        userRole: z.string().nullable(),
                        commentApproval: z.string(),
                        createdAt: z.string(),
                        priority: z.string(),
                        status: z.string(),
                        url: z.url()                        
                    })),
                    summary: z.object({
                        pendingForMe: z.number(),
                        pendingForOthers: z.number(),
                        approveds: z.number(),
                        refusals: z.number(),
                        ratioApproveds: z.number()
                    })
                }),
                500: z.object({
                    message: z.string()
                })
            },
        },
    }, async (request, reply) => {
        try {
            const { idGLPI } = request.user

            const loginGLPI = await loginGlpi()

            const response = await fetch(
                `${env.GLPI_URL}/TicketValidation?range=0-999`,
                {
                    headers: {
                        "Session-Token": loginGLPI.session_token,
                        "App-Token": env.GLPI_APP_TOKEN,
                    }
                }
            );

            const data = await response.json() as TicketValidation[];

            const ticketValidationsPending = data.filter((ticket) => ticket.items_id_target === Number(idGLPI) && ticket.status === 2);

            const ticketsValidationsPendings = await Promise.all(ticketValidationsPending.map(async (ticket) => {
                const response = await fetch(
                    `${env.GLPI_URL}/Ticket/${ticket.tickets_id}`,
                    {
                        headers: {
                            "Session-Token": loginGLPI.session_token,
                            "App-Token": env.GLPI_APP_TOKEN,
                        }
                    }
                );

                const ticketDetails = await response.json() as Ticket;

                const user = await prisma.users.findFirst({
                    where: {
                        cd_id_glpi: String(ticketDetails.users_id_recipient)
                    }
                });

                let pathUrl = null;
                let userGLPIDetails = {
                    firstname: ""
                } as { firstname: string};

                if(!user) {
                    pathUrl = null
                    const responseUser = await fetch(
                    `${env.GLPI_URL}/User/${ticketDetails.users_id_recipient}`,
                    {
                        headers: {
                            "Session-Token": loginGLPI.session_token,
                            "App-Token": env.GLPI_APP_TOKEN,
                        }
                    }
                );

                userGLPIDetails = await responseUser.json() as {firstname: string };
                } else {
                    pathUrl = user.ds_avatar_url
                }

                return {
                    id: ticket.id,
                    ticketTitle: ticketDetails.name ?? "",
                    ticketDescription: ticketDetails.content ?? "",
                    itilcategories_id: ticketDetails.itilcategories_id,
                    time_to_own: ticketDetails.time_to_own,
                    requester: user?.ds_name ?? userGLPIDetails?.firstname,
                    userRole: user?.ds_role_description ?? null,
                    requesterId: ticket.items_id_target,
                    requesterPathUrl: pathUrl,
                    commentApproval: ticket.comment_submission || "Sem comentário",
                    createdAt: ticketDetails.date_creation,
                    priority: "Alta",
                    status: "Pendente",
                    url: `https://glpi.lusati.com.br/front/ticket.form.php?id=${ticketDetails.id}`
                }
            }))

            const summary = {
                pendingForMe: ticketsValidationsPendings.filter(ticket => ticket.requesterId === Number(idGLPI)).length,
                pendingForOthers: ticketsValidationsPendings.filter(ticket => ticket.requesterId !== Number(idGLPI)).length,
                approveds: data.length,
                refusals: data.filter(ticket =>  ticket.status === 4).length,
                ratioApproveds: ((data.filter(ticket => ticket.status === 3).length / data.length) * 100)
            }

            return reply.send({
                ticketsValidationsPendings,
                summary
            });
        } catch (error) {
            console.error(error);

            return reply.status(500).send({
                message: "Internal server error",
            });
        }
    })
}