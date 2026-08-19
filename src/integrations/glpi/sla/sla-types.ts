export interface SLAResult {
  title: "Atendimento" | "Resolução";

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

export type SLAType = "Atendimento" | "Resolução";

export type Priority =
  | "Muito Baixa"
  | "Baixa"
  | "Média"
  | "Alta"
  | "Muito Alta";

export interface SLARule {
  atendimento: number;
  resolucao: number;
}

export type SLARules = Record<Priority, SLARule>;

export const SLA_RULES = {
    1: {
        atendimento: 8,
        resolucao: 48,
    },

    2: {
        atendimento: 4,
        resolucao: 24,
    },

    3: {
        atendimento: 4,
        resolucao: 24,
    },

    4: {
        atendimento: 2,
        resolucao: 8,
    },

    5: {
        atendimento: 1,
        resolucao: 4,
    },

    6: {
        atendimento: 1,
        resolucao: 2,
    },
} as const;