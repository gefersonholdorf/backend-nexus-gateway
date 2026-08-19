import { BusinessCalendarService } from "./business-calendar-service";

export type SLAType = "Atendimento" | "Resolução";

export interface CalculateSLAParams {
  type: SLAType;
  startDate: Date;
  dueDate: Date | null;
  completedDate?: Date | null;
  paused?: boolean;
}

export interface SLAResult {
  title: SLAType;
  label: string;

  percentageValue: number;
  percentage: number;

  color: "green" | "yellow" | "orange" | "red";

  expired: boolean;
  completed: boolean;

  startDate: Date;
  dueDate: Date | null;
  completedDate: Date | null;

  remainingSeconds: number;
  elapsedSeconds: number;
  totalSeconds: number;
}

export class SLAService {

  constructor(
    private readonly calendar: BusinessCalendarService
  ) {}

  calculate({
    type,
    startDate,
    dueDate,
    completedDate = null,
    paused = false,
  }: CalculateSLAParams): SLAResult {

    /**
     * Não existe SLA configurado
     */
    if (!dueDate) {
      return {
        title: type,
        label: "---",

        percentageValue: 0,
        percentage: 0,

        color: "green",

        expired: false,
        completed: false,

        startDate,
        dueDate: null,
        completedDate,

        remainingSeconds: 0,
        elapsedSeconds: 0,
        totalSeconds: 0,
      };
    }

    /**
     * SLA pausado
     */
    if (paused) {
      const totalSeconds =
        this.calendar.calculateBusinessSeconds(
          startDate,
          dueDate
        );

      return {
        title: type,
        label: "SLA Pausado",

        percentageValue: 0,
        percentage: 100,

        color: "yellow",

        expired: false,
        completed: false,

        startDate,
        dueDate,
        completedDate,

        remainingSeconds: 0,
        elapsedSeconds: 0,
        totalSeconds,
      };
    }

    /**
     * Data usada para calcular o SLA.
     *
     * Se já foi concluído:
     * utiliza completedDate.
     *
     * Caso contrário:
     * utiliza agora.
     */
    const compareDate =
      completedDate ?? new Date();

    /**
     * Calcula o tempo total em HORAS ÚTEIS.
     */
    const totalSeconds =
      this.calendar.calculateBusinessSeconds(
        startDate,
        dueDate
      );

    /**
     * Calcula quanto tempo útil já passou.
     */
    const elapsedSeconds =
      this.calendar.calculateBusinessSeconds(
        startDate,
        compareDate
      );

    /**
     * Calcula quanto tempo útil ainda resta.
     */
    const remainingSeconds =
      Math.max(
        0,
        totalSeconds - elapsedSeconds
      );

    const completed = !!completedDate;

    /**
     * Verifica se terminou depois do vencimento.
     *
     * Aqui também usamos calendário útil.
     */
    const completedLate =
      completed &&
      compareDate.getTime() > dueDate.getTime();

    /**
     * Concluído fora do SLA
     */
    if (completedLate) {
      return {
        title: type,
        label: "Concluído fora do SLA",

        percentageValue: 0,
        percentage: 100,

        color: "red",

        expired: true,
        completed: true,

        startDate,
        dueDate,
        completedDate,

        remainingSeconds: 0,
        elapsedSeconds,
        totalSeconds,
      };
    }

    /**
     * SLA expirado
     */
    if (
      !completed &&
      compareDate.getTime() >= dueDate.getTime()
    ) {
      return {
        title: type,
        label: "Expirado",

        percentageValue: 0,
        percentage: 100,

        color: "red",

        expired: true,
        completed: false,

        startDate,
        dueDate,
        completedDate,

        remainingSeconds: 0,
        elapsedSeconds,
        totalSeconds,
      };
    }

    /**
     * Percentual de SLA restante.
     *
     * Exemplo:
     *
     * total = 4h
     * restante = 2h
     *
     * 2 / 4 = 50%
     */
    const percentage =
      totalSeconds > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (remainingSeconds / totalSeconds) * 100
              )
            )
          )
        : 0;

    /**
     * Define a cor conforme o percentual restante.
     */
    let color: SLAResult["color"];

    if (percentage > 50) {
      color = "green";
    } else if (percentage > 25) {
      color = "yellow";
    } else if (percentage > 10) {
      color = "orange";
    } else {
      color = "red";
    }

    const remainingText =
      this.formatRemaining(
        remainingSeconds
      );

    return {
      title: type,

      label: completed
        ? "Concluído"
        : `${remainingText} restantes`,

      percentageValue: percentage,
      percentage,

      color: completed
        ? "green"
        : color,

      expired: false,
      completed,

      startDate,
      dueDate,
      completedDate,

      remainingSeconds,
      elapsedSeconds,
      totalSeconds,
    };
  }

  private formatRemaining(
    seconds: number
  ): string {

    const days =
      Math.floor(seconds / 86400);

    const hours =
      Math.floor(
        (seconds % 86400) / 3600
      );

    const minutes =
      Math.floor(
        (seconds % 3600) / 60
      );

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }

    return `${minutes}min`;
  }
}