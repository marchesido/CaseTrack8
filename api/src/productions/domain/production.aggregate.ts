import { BadRequestException } from '@nestjs/common';
import { ProductionPeriod } from './value-objects/production-period.vo';
import {
  ProductionLifecycleStage,
  ProductionStageVO,
} from './value-objects/production-stage.vo';

export class ProductionEquipmentAllocation {
  public readonly equipmentId: string;
  public readonly quantity: 1 = 1;
  public readonly assignedAt: Date;
  private _isActive: boolean;
  private _isReturned: boolean;

  constructor(params: {
    equipmentId: string;
    assignedAt?: Date;
    isActive?: boolean;
    isReturned?: boolean;
  }) {
    if (!params.equipmentId || params.equipmentId.trim().length === 0) {
      throw new BadRequestException(
        'O identificador do equipamento alocado é obrigatório.',
      );
    }
    this.equipmentId = params.equipmentId;
    this.assignedAt = params.assignedAt ?? new Date();
    this._isActive = params.isActive ?? true;
    this._isReturned = params.isReturned ?? false;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get isReturned(): boolean {
    return this._isReturned;
  }

  public markReturned(): void {
    this._isReturned = true;
  }

  public deactivate(): void {
    this._isActive = false;
  }
}

export class ProductionAggregate {
  public readonly id: string;
  private _title: string;
  private _description: string | null;
  private _stage: ProductionStageVO;
  private _period: ProductionPeriod;
  private _equipments: ProductionEquipmentAllocation[];

  constructor(params: {
    id: string;
    title: string;
    description?: string | null;
    stage: ProductionStageVO;
    period: ProductionPeriod;
    equipments?: ProductionEquipmentAllocation[];
  }) {
    if (!params.title || params.title.trim().length === 0) {
      throw new BadRequestException('O título da produção é obrigatório.');
    }
    this.id = params.id;
    this._title = params.title.trim();
    this._description = params.description ?? null;
    this._stage = params.stage;
    this._period = params.period;
    this._equipments = [...(params.equipments ?? [])];
  }

  public get title(): string {
    return this._title;
  }

  public get description(): string | null {
    return this._description;
  }

  public get stage(): ProductionStageVO {
    return this._stage;
  }

  public get period(): ProductionPeriod {
    return this._period;
  }

  public get equipments(): ReadonlyArray<ProductionEquipmentAllocation> {
    return this._equipments;
  }

  public allocateEquipment(equipmentId: string): void {
    if (
      this._stage.value === ProductionLifecycleStage.COMPLETED ||
      this._stage.value === ProductionLifecycleStage.CANCELLED
    ) {
      throw new BadRequestException(
        'Não é permitido alocar equipamentos em uma produção concluída ou cancelada.',
      );
    }

    const alreadyAllocated = this._equipments.some(
      (item) => item.equipmentId === equipmentId && item.isActive,
    );
    if (alreadyAllocated) {
      throw new BadRequestException(
        `O equipamento ${equipmentId} já está alocado ativamente nesta produção.`,
      );
    }

    this._equipments.push(new ProductionEquipmentAllocation({ equipmentId }));
  }

  public confirm(): void {
    this._stage = this._stage.transitionTo(ProductionLifecycleStage.SCHEDULED);
  }

  public start(): void {
    this._stage = this._stage.transitionTo(ProductionLifecycleStage.IN_PROGRESS);
  }

  public complete(): void {
    const pendingReturn = this._equipments.some(
      (item) => item.isActive && !item.isReturned,
    );
    if (pendingReturn) {
      throw new BadRequestException(
        'Todos os equipamentos ativos devem ser devolvidos (check-in) antes da conclusão da produção.',
      );
    }
    this._stage = this._stage.transitionTo(ProductionLifecycleStage.COMPLETED);
  }

  public cancel(): void {
    this._stage = this._stage.transitionTo(ProductionLifecycleStage.CANCELLED);
  }
}
