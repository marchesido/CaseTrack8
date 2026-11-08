import { BadRequestException } from '@nestjs/common';

export enum ProductionLifecycleStage {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

const ALLOWED_TRANSITIONS: Record<
  ProductionLifecycleStage,
  ProductionLifecycleStage[]
> = {
  [ProductionLifecycleStage.DRAFT]: [
    ProductionLifecycleStage.SCHEDULED,
    ProductionLifecycleStage.CANCELLED,
  ],
  [ProductionLifecycleStage.SCHEDULED]: [
    ProductionLifecycleStage.IN_PROGRESS,
    ProductionLifecycleStage.CANCELLED,
  ],
  [ProductionLifecycleStage.IN_PROGRESS]: [ProductionLifecycleStage.COMPLETED],
  [ProductionLifecycleStage.COMPLETED]: [],
  [ProductionLifecycleStage.CANCELLED]: [],
};

export class ProductionStageVO {
  public readonly value: ProductionLifecycleStage;

  private constructor(value: ProductionLifecycleStage) {
    this.value = value;
    Object.freeze(this);
  }

  public static create(value: ProductionLifecycleStage | string): ProductionStageVO {
    const normalized =
      value === 'CONFIRMED' ? ProductionLifecycleStage.SCHEDULED : value;

    if (
      !Object.values(ProductionLifecycleStage).includes(
        normalized as ProductionLifecycleStage,
      )
    ) {
      throw new BadRequestException(`Estado de produção inválido: ${value}`);
    }

    return new ProductionStageVO(normalized as ProductionLifecycleStage);
  }

  public canTransitionTo(next: ProductionLifecycleStage): boolean {
    return ALLOWED_TRANSITIONS[this.value].includes(next);
  }

  public transitionTo(next: ProductionLifecycleStage): ProductionStageVO {
    if (!this.canTransitionTo(next)) {
      throw new BadRequestException(
        `Transição de estado inválida de '${this.value}' para '${next}'.`,
      );
    }
    return new ProductionStageVO(next);
  }

  public equals(other: ProductionStageVO): boolean {
    return this.value === other.value;
  }
}
