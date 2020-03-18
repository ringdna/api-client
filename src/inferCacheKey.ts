import { CacheType } from './constants'

function inferCacheKey(key: string, cacheType: CacheType, independent: boolean, signature: string) {
  // cacheType:key:signature + :random if independent
  return `${cacheType}:${key}:${signature}${independent ? ':' + Math.random() : ''}`
}

export { inferCacheKey }
