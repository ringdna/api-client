import { CacheType } from './constants'

function inferCacheKey(
  api: string | undefined,
  key: string,
  cacheType: CacheType,
  independent: boolean,
  signature: string
) {
  // cacheType:key:signature + :random if independent
  return `${cacheType}:${api}:${key}:${signature}:${independent ? Math.random() : ''}`
}

export { inferCacheKey }
