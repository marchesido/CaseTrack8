import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { Observable, from, of } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import {
  CACHEABLE_METADATA_KEY,
  CacheableOptions,
} from '../decorators/cacheable.decorator';
import { INVALIDATE_CACHE_METADATA_KEY } from '../decorators/invalidate-cache.decorator';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const handler = context.getHandler();
    const cacheableOptions = this.reflector.get<CacheableOptions | undefined>(
      CACHEABLE_METADATA_KEY,
      handler,
    );
    const invalidateNamespaces = this.reflector.get<string[] | undefined>(
      INVALIDATE_CACHE_METADATA_KEY,
      handler,
    );

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    if (cacheableOptions && request.method === 'GET') {
      const queryHash = this.buildCanonicalQueryHash(request);
      return from(
        this.redisService.getWithEpoch(cacheableOptions.namespace, queryHash),
      ).pipe(
        mergeMap((cachedValue) => {
          if (cachedValue !== null) {
            response.setHeader('X-Cache', 'HIT');
            return of(cachedValue);
          }

          response.setHeader('X-Cache', 'MISS');
          return next.handle().pipe(
            tap((data) => {
              void this.redisService.setWithEpoch(
                cacheableOptions.namespace,
                queryHash,
                data,
                cacheableOptions.ttl ?? 60,
              );
            }),
          );
        }),
      );
    }

    if (invalidateNamespaces && invalidateNamespaces.length > 0) {
      return next.handle().pipe(
        tap(() => {
          void this.redisService.incrementEpoch(invalidateNamespaces);
        }),
      );
    }

    return next.handle();
  }

  public buildCanonicalQueryHash(request: Request): string {
    const queryObj = request.query ?? {};
    const sortedKeys = Object.keys(queryObj).sort();
    const canonicalPairs = sortedKeys.map(
      (key) => `${key}=${JSON.stringify(queryObj[key])}`,
    );
    const rawIdentity = `${request.baseUrl}${request.path}?${canonicalPairs.join('&')}`;
    return createHash('sha256').update(rawIdentity).digest('hex').slice(0, 16);
  }
}
