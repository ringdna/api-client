import { ResourceGeneric, CacheType, Storage } from '../constants'

type Subscriber = () => void

class ClientCache {
  isReady = false
  readyPromise: Promise<void>
  initSize = -1
  listeners: Set<Subscriber> = new Set()
  data: Array<ResourceGeneric> = []
  map: Map<string, ResourceGeneric> = new Map()
  renewTime = Date.now()

  // @TODO add default cache timeout
  constructor(public storageKey: string, public storage: Storage) {
    this.readyPromise = new Promise(resolve => this.rehydrate(resolve))
  }

  renew() {
    this.renewTime = Date.now()
    this.notify()
  }

  notify() {
    // @TODO debounce / batch
    this.listeners.forEach(sub => sub())
  }
  subscribe(subscriber: Subscriber) {
    this.listeners.add(subscriber)
    return () => {
      this.listeners.delete(subscriber)
    }
  }

  persist() {
    // only persist keys which start with CacheType.Disk
    // @TODO there will be perf issues here with large caches. Consider using async serialize, and persisting the persistData object in memory. Also requestIdleCallback.
    let persistData = this.data.filter(v => {
      return v.cacheKey.indexOf(CacheType.Disk) === 0
    })
    return this.storage.setItem(this.storageKey, JSON.stringify(persistData))
  }
  purge() {
    this.data = []
    this.map = new Map()
    this.notify()
    return this.persist()
  }
  async rehydrate(onComplete: Function) {
    let serialData = await this.storage.getItem(this.storageKey)
    if (serialData) {
      this.data = JSON.parse(serialData)
      this.data.forEach(v => {
        this.map.set(v.cacheKey, v)
      })
      this.initSize = serialData.length
    }
    this.isReady = true
    onComplete()
    this.notify()
  }

  async set(key: string, value: ResourceGeneric) {
    if (process.env.NODE_ENV !== 'production' && !this.isReady)
      console.error(
        'WARNING: setting the ClientCache before it is ready can lead to unexpected results. Usually waiting for ready is handled by the createUseFetch* implementation.'
      )
    this.map.set(key, value)
    // @TODO should we remove earlier versions of the resource? should we maintain order by timestamp?
    this.data.push(value)
    this.persist()
    this.notify()
  }

  // get cannot be async as it is used in hooks
  get = (k: string) => this.map.get(k)
}

export { ClientCache }
