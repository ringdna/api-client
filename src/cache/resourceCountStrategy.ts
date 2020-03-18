// This is the simplest possible cache strategy:
// keep the cache under a specified number of items, process only once on startup
import { ClientCache } from './ClientCache'
import { CacheStrategy } from '../constants'

function createResourceCountStrategy(max: number): CacheStrategy {
  return (cache: ClientCache) => {
    cache.readyPromise.then(() => {
      // @ts-ignore ts does not know of rIC
      requestIdleCallback(() => {
        if (cache.data.length > max) {
          // trim off the front of the cache and remove said items from the map
          cache.data.splice(0, cache.data.length - max).forEach(v => {
            cache.map.delete(v.cacheKey)
          })
          cache.persist()
        }
      })
    })
  }
}

export { createResourceCountStrategy }
