export const REDIS_CACHE_CLIENT = 'REDIS_CACHE_CLIENT';
export const REDIS_PUBLISHER_CLIENT = 'REDIS_PUBLISHER_CLIENT';
export const REDIS_SUBSCRIBER_CLIENT = 'REDIS_SUBSCRIBER_CLIENT';

export const CHANNEL_CASETRACK_EVENTS = 'casetrack:events';

export const EPOCH_PREFIX = 'epoch:';
export const CACHE_PREFIX = 'cache:';

export interface DomainEventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: string;
  version: number;
  payload: T;
}
