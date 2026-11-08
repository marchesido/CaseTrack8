import { SetMetadata } from '@nestjs/common';

export const INVALIDATE_CACHE_METADATA_KEY = 'casetrack:invalidate_cache';

export const InvalidateCache = (namespaces: string[]) =>
  SetMetadata(INVALIDATE_CACHE_METADATA_KEY, namespaces);
