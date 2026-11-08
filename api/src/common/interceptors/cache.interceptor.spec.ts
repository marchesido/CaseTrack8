import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { CacheInterceptor } from './cache.interceptor';
import { RedisService } from '../../redis/redis.service';

describe('CacheInterceptor', () => {
  let interceptor: CacheInterceptor;
  let reflector: Reflector;
  let mockRedisService: {
    getWithEpoch: jest.Mock;
    setWithEpoch: jest.Mock;
    incrementEpoch: jest.Mock;
  };

  beforeEach(() => {
    reflector = new Reflector();
    mockRedisService = {
      getWithEpoch: jest.fn(),
      setWithEpoch: jest.fn().mockResolvedValue(undefined),
      incrementEpoch: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new CacheInterceptor(
      reflector,
      mockRedisService as unknown as RedisService,
    );
  });

  function createMockContext(
    method: string,
    query: Record<string, unknown> = {},
  ): {
    context: ExecutionContext;
    headers: Record<string, string>;
  } {
    const headers: Record<string, string> = {};
    const request = {
      method,
      baseUrl: '/api/v1',
      path: '/equipments',
      query,
    };
    const response = {
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v;
      }),
    };

    const context = {
      getType: () => 'http',
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { context, headers };
  }

  it('deve produzir o mesmo hash canônico independentemente da ordem dos query params', () => {
    const reqA = {
      baseUrl: '/api/v1',
      path: '/equipments',
      query: { take: '10', skip: '0', category: 'camera' },
    } as any;
    const reqB = {
      baseUrl: '/api/v1',
      path: '/equipments',
      query: { category: 'camera', skip: '0', take: '10' },
    } as any;

    expect(interceptor.buildCanonicalQueryHash(reqA)).toBe(
      interceptor.buildCanonicalQueryHash(reqB),
    );
  });

  it('deve retornar X-Cache: HIT quando o dado estiver presente no Redis', async () => {
    jest
      .spyOn(reflector, 'get')
      .mockImplementation((key: string) =>
        key === 'casetrack:cacheable'
          ? { namespace: 'equipments', ttl: 60 }
          : undefined,
      );

    mockRedisService.getWithEpoch.mockResolvedValueOnce([{ id: 'cached-1' }]);

    const { context, headers } = createMockContext('GET', { skip: '0' });
    const next: CallHandler = { handle: jest.fn(() => of([{ id: 'db-1' }])) };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual([{ id: 'cached-1' }]);
    expect(headers['X-Cache']).toBe('HIT');
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('deve retornar X-Cache: MISS e gravar no Redis quando não houver cache', async () => {
    jest
      .spyOn(reflector, 'get')
      .mockImplementation((key: string) =>
        key === 'casetrack:cacheable'
          ? { namespace: 'equipments', ttl: 60 }
          : undefined,
      );

    mockRedisService.getWithEpoch.mockResolvedValueOnce(null);

    const { context, headers } = createMockContext('GET');
    const next: CallHandler = { handle: jest.fn(() => of([{ id: 'db-1' }])) };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual([{ id: 'db-1' }]);
    expect(headers['X-Cache']).toBe('MISS');
    expect(mockRedisService.setWithEpoch).toHaveBeenCalledWith(
      'equipments',
      expect.any(String),
      [{ id: 'db-1' }],
      60,
    );
  });

  it('deve incrementar a época em rotas decoradas com @InvalidateCache', async () => {
    jest
      .spyOn(reflector, 'get')
      .mockImplementation((key: string) =>
        key === 'casetrack:invalidate_cache'
          ? ['equipments', 'dashboard']
          : undefined,
      );

    const { context } = createMockContext('POST');
    const next: CallHandler = {
      handle: jest.fn(() => of({ id: 'created-1' })),
    };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(mockRedisService.incrementEpoch).toHaveBeenCalledWith([
      'equipments',
      'dashboard',
    ]);
  });
});
