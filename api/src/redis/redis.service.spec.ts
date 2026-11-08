import { Test, TestingModule } from '@nestjs/testing';
import {
  CHANNEL_CASETRACK_EVENTS,
  DomainEventEnvelope,
  REDIS_CACHE_CLIENT,
  REDIS_PUBLISHER_CLIENT,
  REDIS_SUBSCRIBER_CLIENT,
} from './redis.constants';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockCacheClient: {
    get: jest.Mock;
    set: jest.Mock;
    setex: jest.Mock;
    incr: jest.Mock;
    quit: jest.Mock;
  };
  let mockPublisherClient: {
    publish: jest.Mock;
    quit: jest.Mock;
  };
  let mockSubscriberClient: {
    quit: jest.Mock;
  };

  beforeEach(async () => {
    mockCacheClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      incr: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    mockPublisherClient = {
      publish: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    mockSubscriberClient = {
      quit: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: REDIS_CACHE_CLIENT, useValue: mockCacheClient },
        { provide: REDIS_PUBLISHER_CLIENT, useValue: mockPublisherClient },
        { provide: REDIS_SUBSCRIBER_CLIENT, useValue: mockSubscriberClient },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('deve inicializar época em 1 caso não exista no Redis', async () => {
    mockCacheClient.get.mockResolvedValueOnce(null);
    const epoch = await service.getCurrentEpoch('equipments');
    expect(epoch).toBe(1);
    expect(mockCacheClient.set).toHaveBeenCalledWith('epoch:equipments', '1');
  });

  it('deve retornar payload do cache quando houver CACHE HIT na época ativa', async () => {
    mockCacheClient.get
      .mockResolvedValueOnce('2')
      .mockResolvedValueOnce(JSON.stringify([{ id: 'eq-1', name: 'Sony FX3' }]));

    const result = await service.getWithEpoch<Array<{ id: string }>>(
      'equipments',
      'hash123',
    );
    expect(result).toEqual([{ id: 'eq-1', name: 'Sony FX3' }]);
    expect(mockCacheClient.get).toHaveBeenCalledWith(
      'cache:equipments:v2:hash123',
    );
  });

  it('deve retornar null quando houver CACHE MISS ou falha de conexão (degradação graciosa)', async () => {
    mockCacheClient.get
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce(null);

    const missResult = await service.getWithEpoch('equipments', 'hash999');
    expect(missResult).toBeNull();

    mockCacheClient.get.mockRejectedValueOnce(new Error('Redis connection lost'));
    const degradedResult = await service.getWithEpoch('equipments', 'hash999');
    expect(degradedResult).toBeNull();
  });

  it('deve gravar com TTL usando SETEX na época atual', async () => {
    mockCacheClient.get.mockResolvedValueOnce('3');
    await service.setWithEpoch('productions', 'qhash', { total: 5 }, 60);

    expect(mockCacheClient.setex).toHaveBeenCalledWith(
      'cache:productions:v3:qhash',
      60,
      JSON.stringify({ total: 5 }),
    );
  });

  it('deve invalidar múltiplos namespaces em O(1) via INCR epoch:<namespace>', async () => {
    mockCacheClient.incr.mockResolvedValueOnce(2).mockResolvedValueOnce(5);
    await service.incrementEpoch(['productions', 'dashboard']);

    expect(mockCacheClient.incr).toHaveBeenCalledWith('epoch:productions');
    expect(mockCacheClient.incr).toHaveBeenCalledWith('epoch:dashboard');
  });

  it('deve publicar envelope de evento de domínio no canal Pub/Sub', async () => {
    const envelope: DomainEventEnvelope = {
      eventId: 'evt-1',
      eventType: 'ProductionConfirmedEvent',
      aggregateId: 'prod-1',
      occurredAt: '2026-11-08T18:00:00.000Z',
      version: 1,
      payload: { productionId: 'prod-1', status: 'SCHEDULED' },
    };

    await service.publishDomainEvent(envelope);

    expect(mockPublisherClient.publish).toHaveBeenCalledWith(
      CHANNEL_CASETRACK_EVENTS,
      JSON.stringify(envelope),
    );
  });
});
