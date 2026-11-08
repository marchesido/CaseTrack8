import {
  Production,
  ProductionStatus,
} from '../entities/production.entity';
import { MovementStatus } from '../entities/production-equipment.entity';
import {
  ProductionAggregate,
  ProductionEquipmentAllocation,
} from './production.aggregate';
import { ProductionPeriod } from './value-objects/production-period.vo';
import {
  ProductionLifecycleStage,
  ProductionStageVO,
} from './value-objects/production-stage.vo';

export class ProductionMapper {
  public static toDomain(entity: Production): ProductionAggregate {
    const period = ProductionPeriod.create(
      entity.scheduledAt,
      entity.scheduledEndAt,
    );
    const stage = ProductionStageVO.create(entity.status);

    const equipments = (entity.productionEquipments ?? []).map(
      (pe) =>
        new ProductionEquipmentAllocation({
          equipmentId: pe.equipment?.id,
          assignedAt: pe.createdAt,
          isActive: pe.isActive,
          isReturned:
            pe.movementStatus === MovementStatus.RETURNED_OK ||
            pe.movementStatus === MovementStatus.RETURNED_DAMAGED ||
            pe.movementStatus === MovementStatus.PENDING_CHECKOUT,
        }),
    );

    return new ProductionAggregate({
      id: entity.id,
      title: entity.title,
      description: entity.description,
      stage,
      period,
      equipments,
    });
  }

  public static toPersistenceStatus(
    stage: ProductionStageVO,
  ): ProductionStatus {
    switch (stage.value) {
      case ProductionLifecycleStage.DRAFT:
      case ProductionLifecycleStage.SCHEDULED:
        return ProductionStatus.SCHEDULED;
      case ProductionLifecycleStage.IN_PROGRESS:
        return ProductionStatus.IN_PROGRESS;
      case ProductionLifecycleStage.COMPLETED:
        return ProductionStatus.COMPLETED;
      case ProductionLifecycleStage.CANCELLED:
        return ProductionStatus.CANCELLED;
    }
  }
}
