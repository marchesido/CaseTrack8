import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_METADATA_KEY = 'casetrack:cacheable';

export interface CacheableOptions {
  namespace: string;
  ttl?: number;
}

export const Cacheable = (options: CacheableOptions) =>
  SetMetadata(CACHEABLE_METADATA_KEY, {
    namespace: options.namespace,
    ttl: options.ttl ?? 60,
  });
