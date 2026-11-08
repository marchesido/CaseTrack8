import { BadRequestException } from '@nestjs/common';
import {
  ProductionAggregate,
  ProductionEquipmentAllocation,
} from './production.aggregate';
import { ProductionPeriod } from './value-objects/production-period.vo';
import {
  ProductionLifecycleStage,
  ProductionStageVO,
} from './value-objects/production-stage.vo';

describe('ProductionAggregate & Tactical DDD Value Objects', () => {
  const validStart = new Date('2026-12-01T08:00:00.000Z');
  const validEnd = new Date('2026-12-01T18:00:00.000Z');

  it('deve criar ProductionPeriod válido e detectar sobreposição de horários', () => {
    const periodA = ProductionPeriod.create(validStart, validEnd);
    const periodOverlap = ProductionPeriod.create(
      new Date('2026-12-01T14:00:00.000Z'),
      new Date('2026-12-01T20:00:00.000Z'),
    );
    const periodDisjoint = ProductionPeriod.create(
      new Date('2026-12-02T08:00:00.000Z'),
      new Date('2026-12-02T14:00:00.000Z'),
    );

    expect(periodA.overlapsWith(periodOverlap)).toBe(true);
    expect(periodA.overlapsWith(periodDisjoint)).toBe(false);
  });

  it('deve rejeitar ProductionPeriod com data final anterior à inicial ou duração < 1h', () => {
    expect(() =>
      ProductionPeriod.create(validEnd, validStart),
    ).toThrow(BadRequestException);

    expect(() =>
      ProductionPeriod.create(
        validStart,
        new Date(validStart.getTime() + 30 * 60 * 1000),
      ),
    ).toThrow(BadRequestException);
  });

  it('deve respeitar transições válidas de ciclo de vida no ProductionAggregate', () => {
    const aggregate = new ProductionAggregate({
      id: 'prod-1',
      title: 'Documentário Amazônia',
      stage: ProductionStageVO.create(ProductionLifecycleStage.DRAFT),
      period: ProductionPeriod.create(validStart, validEnd),
    });

    aggregate.confirm();
    expect(aggregate.stage.value).toBe(ProductionLifecycleStage.SCHEDULED);

    aggregate.start();
    expect(aggregate.stage.value).toBe(ProductionLifecycleStage.IN_PROGRESS);
  });

  it('deve impedir conclusão da produção enquanto houver equipamento ativo não devolvido', () => {
    const allocation = new ProductionEquipmentAllocation({
      equipmentId: 'eq-camera-1',
      isActive: true,
      isReturned: false,
    });

    const aggregate = new ProductionAggregate({
      id: 'prod-2',
      title: 'Publicidade Estúdio',
      stage: ProductionStageVO.create(ProductionLifecycleStage.IN_PROGRESS),
      period: ProductionPeriod.create(validStart, validEnd),
      equipments: [allocation],
    });

    expect(() => aggregate.complete()).toThrow(BadRequestException);

    allocation.markReturned();
    aggregate.complete();
    expect(aggregate.stage.value).toBe(ProductionLifecycleStage.COMPLETED);
  });

  it('deve impedir alocação duplicada do mesmo equipamento serializado (quantity = 1)', () => {
    const aggregate = new ProductionAggregate({
      id: 'prod-3',
      title: 'Clipe Musical',
      stage: ProductionStageVO.create(ProductionLifecycleStage.SCHEDULED),
      period: ProductionPeriod.create(validStart, validEnd),
    });

    aggregate.allocateEquipment('eq-lens-50mm');
    expect(aggregate.equipments[0].quantity).toBe(1);

    expect(() => aggregate.allocateEquipment('eq-lens-50mm')).toThrow(
      BadRequestException,
    );
  });
});
