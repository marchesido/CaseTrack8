import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProductionPeriod } from '../value-objects/production-period.vo';

@Injectable()
export class EquipmentReservationPolicyService {
  constructor(private readonly dataSource: DataSource) {}

  public async validateNoOverlappingReservations(
    equipmentIds: string[],
    period: ProductionPeriod,
    excludeProductionId?: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!equipmentIds || equipmentIds.length === 0) {
      return;
    }

    const uniqueEquipmentIds = Array.from(new Set(equipmentIds));
    const em = manager ?? this.dataSource.manager;

    // 1. Bloqueio pessimista nas linhas dos equipamentos concorrentes para evitar phantom reads
    await em
      .createQueryBuilder()
      .select('e.id')
      .from('equipments', 'e')
      .where('e.id IN (:...equipmentIds)', { equipmentIds: uniqueEquipmentIds })
      .setLock('pessimistic_write')
      .getRawMany();

    // 2. Consulta transacional de conflitos de sobreposição temporal em produções ativas
    const qb = em
      .createQueryBuilder()
      .select('pe.equipment_id', 'equipmentId')
      .addSelect('p.id', 'productionId')
      .addSelect('p.title', 'productionTitle')
      .from('production_equipments', 'pe')
      .innerJoin('productions', 'p', 'p.id = pe.production_id')
      .where('pe.equipment_id IN (:...equipmentIds)', {
        equipmentIds: uniqueEquipmentIds,
      })
      .andWhere('pe.isActive = :isActive', { isActive: true })
      .andWhere('p.status IN (:...activeStatuses)', {
        activeStatuses: ['SCHEDULED', 'IN_PROGRESS'],
      })
      .andWhere('p.scheduledAt < :newEndDate', {
        newEndDate: period.endDate,
      })
      .andWhere(
        '(p.scheduledEndAt IS NULL OR p.scheduledEndAt > :newStartDate)',
        {
          newStartDate: period.startDate,
        },
      );

    if (excludeProductionId) {
      qb.andWhere('p.id != :currentProductionId', {
        currentProductionId: excludeProductionId,
      });
    }

    const conflicts = await qb.getRawMany<{
      equipmentId: string;
      productionId: string;
      productionTitle: string;
    }>();

    if (conflicts.length > 0) {
      const conflictingIds = Array.from(
        new Set(conflicts.map((c) => c.equipmentId)),
      );
      throw new ConflictException({
        code: 'EQUIPMENT_RESERVATION_CONFLICT',
        message: `Conflito de reserva detectado para os equipamentos: ${conflictingIds.join(', ')}`,
        conflictingEquipmentIds: conflictingIds,
        conflicts,
      });
    }
  }
}
