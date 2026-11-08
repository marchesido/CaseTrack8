import { BadRequestException } from '@nestjs/common';

export class ProductionPeriod {
  public readonly startDate: Date;
  public readonly endDate: Date;

  private constructor(startDate: Date, endDate: Date) {
    this.startDate = new Date(startDate.getTime());
    this.endDate = new Date(endDate.getTime());
    Object.freeze(this);
  }

  public static create(
    startDate: Date | string,
    endDate?: Date | string | null,
  ): ProductionPeriod {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException(
        'Data de início do período da produção é inválida.',
      );
    }

    // Se endDate não for informado, assume janela padrão mínima de 4 horas
    const end = endDate
      ? endDate instanceof Date
        ? endDate
        : new Date(endDate)
      : new Date(start.getTime() + 4 * 60 * 60 * 1000);

    if (Number.isNaN(end.getTime())) {
      throw new BadRequestException(
        'Data de término do período da produção é inválida.',
      );
    }

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'A data de término deve ser estritamente posterior à data de início.',
      );
    }

    const durationMs = end.getTime() - start.getTime();
    const minDurationMs = 60 * 60 * 1000; // 1 hora
    if (durationMs < minDurationMs) {
      throw new BadRequestException(
        'O período da produção deve ter duração mínima de 1 hora.',
      );
    }

    return new ProductionPeriod(start, end);
  }

  public overlapsWith(other: ProductionPeriod): boolean {
    return (
      this.startDate.getTime() < other.endDate.getTime() &&
      this.endDate.getTime() > other.startDate.getTime()
    );
  }

  public equals(other: ProductionPeriod): boolean {
    return (
      this.startDate.getTime() === other.startDate.getTime() &&
      this.endDate.getTime() === other.endDate.getTime()
    );
  }
}
