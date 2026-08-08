import { Ticket } from "@/routes/glpi/get-tickets-route";
import { BusinessCalendarService } from "./business-calendar-service";
import { SLAService } from "./sla-service";
import { SLA_RULES } from "./sla-types";


export function calculateTicketSLA(
    ticketGLPI: Ticket,
    businessCalendar: BusinessCalendarService,
    slaService: SLAService
) {

    const rule =
        SLA_RULES[
            ticketGLPI.priority as keyof typeof SLA_RULES
        ];


    const atendimentoStartDate =
        new Date(ticketGLPI.date);


    const atendimentoDueDate =
        rule
            ? businessCalendar.addBusinessHours(
                atendimentoStartDate,
                rule.atendimento
            )
            : null;


    const atendimentoSLA =
        slaService.calculate({
            type: "Atendimento",

            startDate: atendimentoStartDate,

            dueDate: atendimentoDueDate,

            completedDate:
                ticketGLPI.takeintoaccountdate
                    ? new Date(ticketGLPI.takeintoaccountdate)
                    : null,

            paused:
                ticketGLPI.status === 4 &&
                !ticketGLPI.takeintoaccountdate,
        });


    const resolucaoStartDate =
        ticketGLPI.takeintoaccountdate
            ? new Date(ticketGLPI.takeintoaccountdate)
            : null;


    const resolucaoSLA =
        resolucaoStartDate
            ? slaService.calculate({
                type: "Resolução",

                startDate: resolucaoStartDate,

                dueDate:
                    rule
                        ? businessCalendar.addBusinessHours(
                            resolucaoStartDate,
                            rule.resolucao
                        )
                        : null,

                completedDate:
                    ticketGLPI.solvedate
                        ? new Date(ticketGLPI.solvedate)
                        : null,

                paused:
                    ticketGLPI.status === 4,
            })
            :
            {
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


    return {
        atendimento: atendimentoSLA,
        resolucao: resolucaoSLA
    };
}