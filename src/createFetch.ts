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
  if (process.env.NODE_ENV !== 'production') {
    // @NOTE if you change any of this code, createUseFetch needs to be updated too
    // @ts-ignore
    let ck = globalThis._client_keys || new Set()
    if (ck.has(methodOptions.key))
      throw new Error(
        `You are trying to create a second api method with key: ${methodOptions.key}. This is not supported and can lead to abberant behavior.`
      )
    ck.add(methodOptions.key)
    // @ts-ignore
    globalThis._client_keys = ck
  }

  return async (client: ApiClient, params: Params): Promise<Resource<Payload, Params>> => {
    let { cache, execute } = client
    let independent =
      methodOptions.independent === undefined ? methodOptions.method !== HttpMethods.Get : methodOptions.independent
    let cacheType = methodOptions.cache || CacheType.Memory

    // the logic gets a little tricky in here, but basically we have a set of rules to allow a refetch to override the cacheKey or params.
    let realizedPath = typeof methodOptions.path === 'function' ? methodOptions.path(params) : methodOptions.path
    let cacheKey = inferCacheKey(methodOptions.api, methodOptions.key, cacheType, independent, JSON.stringify(params))

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
