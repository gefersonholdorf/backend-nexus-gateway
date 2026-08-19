export interface BusinessCalendarConfig {
  startHour: number;
  endHour: number;
  holidays?: string[];
}

export class BusinessCalendarService {
  private readonly config: BusinessCalendarConfig;

  constructor(config?: Partial<BusinessCalendarConfig>) {
    this.config = {
      startHour: 8,
      endHour: 18,
      holidays: [],
      ...config,
    };
  }

  /**
   * Verifica se a data é um dia útil.
   */
  isBusinessDay(date: Date): boolean {
    const day = date.getDay();

    // Domingo
    if (day === 0) {
      return false;
    }

    // Sábado
    if (day === 6) {
      return false;
    }

    return !this.isHoliday(date);
  }

  /**
   * Verifica se a data é feriado.
   */
  isHoliday(date: Date): boolean {
    const dateString = this.formatDate(date);

    return this.config.holidays?.includes(dateString) ?? false;
  }

  /**
   * Retorna o início do expediente daquele dia.
   */
  getBusinessStart(date: Date): Date {
    const result = new Date(date);

    result.setHours(
      this.config.startHour,
      0,
      0,
      0
    );

    return result;
  }

  /**
   * Retorna o fim do expediente daquele dia.
   */
  getBusinessEnd(date: Date): Date {
    const result = new Date(date);

    result.setHours(
      this.config.endHour,
      0,
      0,
      0
    );

    return result;
  }

  /**
   * Verifica se um horário está dentro do expediente.
   */
  isWithinBusinessHours(date: Date): boolean {
    if (!this.isBusinessDay(date)) {
      return false;
    }

    const start = this.getBusinessStart(date);
    const end = this.getBusinessEnd(date);

    return date >= start && date < end;
  }

  /**
   * Ajusta uma data para o próximo horário útil.
   */
  moveToBusinessTime(date: Date): Date {
    let current = new Date(date);

    while (true) {
      if (!this.isBusinessDay(current)) {
        current = this.getNextBusinessDay(current);
        current = this.getBusinessStart(current);

        continue;
      }

      const start = this.getBusinessStart(current);
      const end = this.getBusinessEnd(current);

      // Antes do expediente
      if (current < start) {
        return start;
      }

      // Depois do expediente
      if (current >= end) {
        current = this.getNextBusinessDay(current);
        current = this.getBusinessStart(current);

        continue;
      }

      return current;
    }
  }

  /**
   * Retorna o próximo dia útil.
   */
  getNextBusinessDay(date: Date): Date {
    const current = new Date(date);

    do {
      current.setDate(current.getDate() + 1);
    } while (!this.isBusinessDay(current));

    return current;
  }

  /**
   * Soma horas úteis a uma data.
   *
   * Exemplo:
   *
   * sexta-feira 16:00 + 4 horas úteis
   *
   * considerando expediente 08:00 - 18:00:
   *
   * sexta:
   * 16:00 -> 18:00 = 2h
   *
   * segunda:
   * 08:00 -> 10:00 = 2h
   *
   * resultado:
   * segunda-feira 10:00
   */
  addBusinessHours(
    startDate: Date,
    hours: number
  ): Date {
    if (hours <= 0) {
      return this.moveToBusinessTime(startDate);
    }

    let current = this.moveToBusinessTime(startDate);

    let remainingSeconds = hours * 60 * 60;

    while (remainingSeconds > 0) {
      const businessEnd = this.getBusinessEnd(current);

      const availableSeconds = Math.floor(
        (businessEnd.getTime() - current.getTime()) / 1000
      );

      if (remainingSeconds <= availableSeconds) {
        current = new Date(
          current.getTime() +
            remainingSeconds * 1000
        );

        remainingSeconds = 0;

        break;
      }

      remainingSeconds -= availableSeconds;

      current = this.getNextBusinessDay(current);
      current = this.getBusinessStart(current);
    }

    return current;
  }

  /**
   * Calcula quantos segundos úteis existem entre duas datas.
   */
  calculateBusinessSeconds(
    startDate: Date,
    endDate: Date
  ): number {
    if (endDate <= startDate) {
      return 0;
    }

    let current = this.moveToBusinessTime(startDate);

    let totalSeconds = 0;

    while (current < endDate) {
      const businessEnd = this.getBusinessEnd(current);

      const effectiveEnd =
        endDate < businessEnd
          ? endDate
          : businessEnd;

      if (effectiveEnd > current) {
        totalSeconds += Math.floor(
          (effectiveEnd.getTime() -
            current.getTime()) / 1000
        );
      }

      if (effectiveEnd >= endDate) {
        break;
      }

      current = this.getNextBusinessDay(current);
      current = this.getBusinessStart(current);
    }

    return totalSeconds;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }
}