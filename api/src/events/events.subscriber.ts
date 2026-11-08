import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import {
  CHANNEL_CASETRACK_EVENTS,
  DomainEventEnvelope,
  REDIS_SUBSCRIBER_CLIENT,
} from '../redis/redis.constants';

@Injectable()
export class EventsSubscriber implements OnModuleInit {
  private readonly logger = new Logger(EventsSubscriber.name);

  constructor(
    @Inject(REDIS_SUBSCRIBER_CLIENT) private readonly subscriberClient: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      await this.subscriberClient.subscribe(CHANNEL_CASETRACK_EVENTS);
      this.subscriberClient.on('message', (channel: string, message: string) => {
        this.handleIncomingMessage(channel, message);
      });
      this.logger.log(
        `Inscrito com sucesso no canal Redis Pub/Sub: ${CHANNEL_CASETRACK_EVENTS}`,
      );
    } catch (error) {
      this.logger.warn(
        `[PUB/SUB DEGRADED] Não foi possível subscrever ao canal ${CHANNEL_CASETRACK_EVENTS}: ${(error as Error).message}`,
      );
    }
  }

  public handleIncomingMessage(channel: string, message: string): void {
    this.logger.log(
      `[PUB/SUB SUBSCRIBE] Evento recebido no canal ${channel}: ${message}`,
    );
    try {
      const parsed = JSON.parse(message) as DomainEventEnvelope;
      this.logger.debug(
        `Processado evento assíncrono ${parsed.eventType} para agregado ${parsed.aggregateId}`,
      );
    } catch {
      // Payload não-JSON registrado apenas como string bruta no log acima
    }
  }
}
