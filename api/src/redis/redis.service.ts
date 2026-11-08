import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import {
  CACHE_PREFIX,
  CHANNEL_CASETRACK_EVENTS,
  DomainEventEnvelope,
  EPOCH_PREFIX,
  REDIS_CACHE_CLIENT,
  REDIS_PUBLISHER_CLIENT,
  REDIS_SUBSCRIBER_CLIENT,
} from './redis.constants';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CACHE_CLIENT) private readonly cacheClient: Redis,
    @Inject(REDIS_PUBLISHER_CLIENT) private readonly publisherClient: Redis,
    @Inject(REDIS_SUBSCRIBER_CLIENT) private readonly subscriberClient: Redis,
  ) {}

  async getCurrentEpoch(namespace: string): Promise<number> {
    const epochKey = `${EPOCH_PREFIX}${namespace}`;
    try {
      const value = await this.cacheClient.get(epochKey);
      if (!value) {
        await this.cacheClient.set(epochKey, '1');
        return 1;
      }
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 1 : parsed;
    } catch (error) {
      this.logger.warn(
        `[CACHE DEGRADED] Falha ao ler época '${namespace}': ${(error as Error).message}`,
      );
      return 1;
    }
  }

  async getWithEpoch<T>(namespace: string, queryHash: string): Promise<T | null> {
    try {
      const epoch = await this.getCurrentEpoch(namespace);
      const cacheKey = `${CACHE_PREFIX}${namespace}:v${epoch}:${queryHash}`;
      const raw = await this.cacheClient.get(cacheKey);
      if (!raw) {
        this.logger.log(`[CACHE MISS] key=${cacheKey}`);
        return null;
      }
      this.logger.log(`[CACHE HIT] key=${cacheKey}`);
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `[CACHE DEGRADED] Fallback para MySQL na leitura de '${namespace}': ${(error as Error).message}`,
      );
      return null;
    }
  }

  async setWithEpoch(
    namespace: string,
    queryHash: string,
    data: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const epoch = await this.getCurrentEpoch(namespace);
      const cacheKey = `${CACHE_PREFIX}${namespace}:v${epoch}:${queryHash}`;
      await this.cacheClient.setex(cacheKey, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      this.logger.warn(
        `[CACHE DEGRADED] Falha ao gravar cache em '${namespace}': ${(error as Error).message}`,
      );
    }
  }

  async incrementEpoch(namespaces: string | string[]): Promise<void> {
    const targets = Array.isArray(namespaces) ? namespaces : [namespaces];
    for (const ns of targets) {
      const epochKey = `${EPOCH_PREFIX}${ns}`;
      try {
        const nextEpoch = await this.cacheClient.incr(epochKey);
        this.logger.log(
          `[CACHE INVALIDATION O(1)] Namespace '${ns}' avançado para época v${nextEpoch}`,
        );
      } catch (error) {
        this.logger.warn(
          `[CACHE DEGRADED] Falha ao invalidar época '${ns}': ${(error as Error).message}`,
        );
      }
    }
  }

  async publishDomainEvent<T = Record<string, unknown>>(
    envelope: DomainEventEnvelope<T>,
    channel: string = CHANNEL_CASETRACK_EVENTS,
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(envelope);
      await this.publisherClient.publish(channel, serialized);
      this.logger.log(
        `[PUB/SUB PUBLISH] Evento enviado ao canal ${channel}: ${serialized}`,
      );
    } catch (error) {
      this.logger.warn(
        `[PUB/SUB DEGRADED] Falha ao publicar evento '${envelope.eventType}' no canal ${channel}: ${(error as Error).message}`,
      );
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled([
      this.cacheClient.quit(),
      this.publisherClient.quit(),
      this.subscriberClient.quit(),
    ]);
  }
}
