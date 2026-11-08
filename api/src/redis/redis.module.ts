import { Global, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import {
  REDIS_CACHE_CLIENT,
  REDIS_PUBLISHER_CLIENT,
  REDIS_SUBSCRIBER_CLIENT,
} from './redis.constants';
import { RedisService } from './redis.service';

function createRedisClient(
  configService: ConfigService,
  clientName: string,
): Redis {
  const logger = new Logger(`Redis:${clientName}`);
  const host = configService.get<string>('REDIS_HOST', 'localhost');
  const port = Number(configService.get<string>('REDIS_PORT', '6379'));

  const options: RedisOptions = {
    host,
    port,
    commandTimeout: 1500,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (times > 5) {
        logger.warn(
          `Limite de retentativas atingido (${times}). Operando em modo degradado.`,
        );
        return null;
      }
      const jitter = Math.floor(Math.random() * 50);
      return Math.min(times * 100 + jitter, 2000);
    },
  };

  const client = new Redis(options);
  client.on('error', (err: Error) => {
    logger.warn(`Falha de conexão Redis (${clientName}): ${err.message}`);
  });
  if (process.env.NODE_ENV !== 'test') {
    client.connect().catch(() => {
      // Silenciado: o fallback transparente do RedisService assume em caso de indisponibilidade
    });
  }
  return client;
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CACHE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createRedisClient(config, 'Cache'),
    },
    {
      provide: REDIS_PUBLISHER_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createRedisClient(config, 'Publisher'),
    },
    {
      provide: REDIS_SUBSCRIBER_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createRedisClient(config, 'Subscriber'),
    },
    RedisService,
  ],
  exports: [
    REDIS_CACHE_CLIENT,
    REDIS_PUBLISHER_CLIENT,
    REDIS_SUBSCRIBER_CLIENT,
    RedisService,
  ],
})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly redisService: RedisService) {}

  async onModuleDestroy(): Promise<void> {
    await this.redisService.disconnectAll();
  }
}
