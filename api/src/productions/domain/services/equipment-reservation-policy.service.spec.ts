import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EquipmentReservationPolicyService } from './equipment-reservation-policy.service';
import { ProductionPeriod } from '../value-objects/production-period.vo';

describe('EquipmentReservationPolicyService', () => {
  let service: EquipmentReservationPolicyService;
  let mockLockQb: {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    setLock: jest.Mock;
    getRawMany: jest.Mock;
  };
  let mockConflictQb: {
    select: jest.Mock;
    addSelect: jest.Mock;
    from: jest.Mock;
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawMany: jest.Mock;
  };
  let mockManager: {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    mockLockQb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ id: 'eq-1' }]),
    };

    mockConflictQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    mockManager = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(mockLockQb)
        .mockReturnValueOnce(mockConflictQb),
    };

    const mockDataSource = {
      manager: mockManager,
    } as unknown as DataSource;

    service = new EquipmentReservationPolicyService(mockDataSource);
  });

  it('deve adquirir lock pessimista (pessimistic_write) e aprovar quando não houver conflitos', async () => {
    const period = ProductionPeriod.create(
      new Date('2026-12-10T08:00:00.000Z'),
      new Date('2026-12-10T18:00:00.000Z'),
    );

    await expect(
      service.validateNoOverlappingReservations(['eq-1'], period, 'prod-1'),
    ).resolves.toBeUndefined();

    expect(mockLockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(mockConflictQb.getRawMany).toHaveBeenCalled();
  });

  it('deve lançar ConflictException (409) quando equipamento já estiver reservado em produção sobreposta', async () => {
    mockConflictQb.getRawMany.mockResolvedValueOnce([
      {
        equipmentId: 'eq-1',
        productionId: 'prod-existing',
        productionTitle: 'Produção Concorrente',
      },
    ]);

    const period = ProductionPeriod.create(
      new Date('2026-12-10T10:00:00.000Z'),
      new Date('2026-12-10T16:00:00.000Z'),
    );

    await expect(
      service.validateNoOverlappingReservations(['eq-1'], period, 'prod-new'),
    ).rejects.toThrow(ConflictException);
  });
});
