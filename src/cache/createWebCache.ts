import { ClientCache } from './ClientCache'
import { LocalStorage } from './LocalStorage'
import { createResourceCountStrategy } from './resourceCountStrategy'

export default function createWebCache(maxCache = 500) {
  let cacheStrategy = createResourceCountStrategy(maxCache)
  let cache = new ClientCache('client-cache', LocalStorage)
  cacheStrategy(cache)
  return cache
}
