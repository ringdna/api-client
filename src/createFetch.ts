import {
  ApiClient,
  RequestStage,
  MethodOptions,
  ParamsGeneric,
  HttpMethods,
  CacheType,
  ResourceFlag,
  Resource
} from './constants'
import { inferCacheKey } from './inferCacheKey'

function createFetch<Payload, Params extends ParamsGeneric = void | null>(methodOptions: MethodOptions<Params>) {
  return async (client: ApiClient, params: Params): Promise<Resource<Payload, Params>> => {
    let { cache, execute } = client
    let independent =
      methodOptions.independent === undefined ? methodOptions.method !== HttpMethods.Get : methodOptions.independent
    let cacheType = methodOptions.cache || CacheType.Memory

    // the logic gets a little tricky in here, but basically we have a set of rules to allow a refetch to override the cacheKey or params.
    let realizedPath = typeof methodOptions.path === 'function' ? methodOptions.path(params) : methodOptions.path
    let cacheKey = inferCacheKey(methodOptions.key, cacheType, independent, JSON.stringify(params))

    let resource = {
      // if not independent, build on existing resource
      ...(!independent && cache.get(cacheKey)),
      // "realize" methodOptions
      methodOptions: { ...methodOptions, path: realizedPath, independent },
      flag: ResourceFlag.Stable,
      params,
      timestamp: Date.now(),
      stage: RequestStage.Latent,
      cacheKey
    }
    if (!cache.isReady) await cache.readyPromise
    return execute(resource, client) as Promise<Resource<Payload, Params>>
  }
}

export { createFetch }
