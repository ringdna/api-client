import { useEffect, useReducer, useMemo, useRef, useCallback } from 'react'

import { useClient } from './context'
import { inferCacheKey } from '../inferCacheKey'
import {
  Refetch,
  CacheType,
  RequestStage,
  Resource,
  ReturnTuple,
  ParamsGeneric,
  MethodOptions,
  HttpMethods,
  RawCompletionPromise,
  ResourceGeneric,
  Loading,
  ResourceFlag
} from '../constants'
import { createFetch } from '../createFetch'

export type HookOptions = {
  paused?: boolean
  cacheKey?: string
}

function createUseFetch<Payload, Params extends ParamsGeneric = void | null>(methodOptions: MethodOptions<Params>) {
  if (process.env.NODE_ENV !== 'production') {
    // @NOTE if you change any of this code, createFetch needs to be updated too
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

  return (params: Params, hookOptions: HookOptions = {}): ReturnTuple<Payload, Params> => {
    methodOptions.method = methodOptions.method || HttpMethods.Get
    let independent =
      methodOptions.independent === undefined ? methodOptions.method !== HttpMethods.Get : methodOptions.independent
    let cacheType = methodOptions.cache || CacheType.Memory
    let { refetchInterval } = methodOptions

    // to avoid referential inequality issues, stringify params
    const paramsString = useMemo(() => {
      return JSON.stringify(params)
    }, [params])

    let cacheKey = useMemo(() => {
      return (
        hookOptions.cacheKey ||
        inferCacheKey(methodOptions.api, methodOptions.key, cacheType, independent, paramsString)
      )
    }, [hookOptions.cacheKey, cacheType, paramsString, independent])

    let client = useClient()
    let { execute, cache } = client

    // requests wont fire until unpaused and cache is ready
    let paused = hookOptions.paused || !cache.isReady

    const [, forceRender] = useReducer(s => s + 1, 0) // taken from react-redux https://github.com/reduxjs/react-redux/blob/master/src/hooks/useSelector.js#L46

    // if upon instantiation, the cache is not ready, we need to force a render as soon as the cache is ready
    let initRef = useRef<any>()
    if (!cache.isReady && !initRef.current) initRef.current = cache.readyPromise.then(forceRender)

    // @ts-ignore not sure how to get Params an ParamsGeneric subtypes to match
    let resource: Resource<Payload, Params> | undefined = cache.get(cacheKey)
    let resourceRef = useRef<ResourceGeneric | void>()
    if (resource) resourceRef.current = resource

    useEffect(() => {
      if (paused) return
      let _renewTime = cache.renewTime
      return cache.subscribe(() => {
        let cachedResource = cache.get(cacheKey)
        // update when resource changes, or renewTime changes
        if (cachedResource !== resourceRef.current || cache.renewTime !== _renewTime) {
          _renewTime = cache.renewTime
          // @ts-ignore ??
          forceRender()
        }
      })
    }, [cache, cacheKey, params, paused])

    // @TODO do we really need to support override params here? could remove and simplify, but still need a way to support the paged use case
    // @ts-ignore not sure how to get Params an ParamsGeneric subtypes to match
    let refetch: Refetch<Payload, Params> = useCallback(
      (overrideParams?: Params, overrideCacheKey?: string) => {
        // the logic gets a little tricky in here, but basically we have a set of rules to allow a refetch to override the cacheKey or params.
        let realizedPath =
          typeof methodOptions.path === 'function' ? methodOptions.path(overrideParams || params) : methodOptions.path
        let fetchCacheKey = overrideCacheKey
          ? overrideCacheKey
          : overrideParams
          ? inferCacheKey(methodOptions.api, methodOptions.key, cacheType, independent, JSON.stringify(overrideParams))
          : cacheKey

        resourceRef.current = {
          // if not independent, build on existing resource
          ...(!independent && cache.get(cacheKey)),
          flag: ResourceFlag.Stable,
          // "realize" methodOptions
          methodOptions: { ...methodOptions, path: realizedPath, independent },
          params: overrideParams || params,
          timestamp: Date.now(),
          stage: RequestStage.Latent,
          cacheKey: fetchCacheKey
        }
        return execute(resourceRef.current, client)
      },
      [paramsString, cacheKey, client, execute] // eslint-disable-line
    )

    // this is a trick to allow sync setting of the resource to avoid an extra render on the first run
    // it will neccesarily be false again on the next run because the resource is immediately set into the cache
    let openRequest = useRef<Promise<any> | false>()

    // trigger a sync fetch if resource is too old, this is the initial fetch, or resource does not exist in cache
    // @TODO do we want to force a refetch when expired with a setInterval?
    let needsRefetchFromInterval = resource && refetchInterval && resource.timestamp < Date.now() - refetchInterval
    let needsRefetchFromFlag = resource && resource.flag === ResourceFlag.NeedsRefetch
    // @TODO add option to not do init
    let needsInitFetch = resource && resource.timestamp < cache.renewTime
    let fetchSync = !paused && (!resource || needsRefetchFromFlag || needsRefetchFromInterval || needsInitFetch)

    // @TODO add cancellation
    openRequest.current = fetchSync ? refetch().catch(() => {}) : false

    let { fail, success, stage } = resourceRef.current || {}

    // @ts-ignore special method is not well typed
    let completionPromise = resourceRef.current?.[RawCompletionPromise] as Loading<Payload, Params> | undefined
    let failTimestamp = fail && fail.timestamp
    let successTimestamp = success && success.timestamp

    return [
      success ? success.payload : undefined,
      failTimestamp && (!successTimestamp || failTimestamp > successTimestamp) ? fail : undefined,
      (stage === RequestStage.InFlight && completionPromise) || false,
      refetch,
      resource
    ]
  }
}

function createUseFetchAction<Payload, Params extends ParamsGeneric = void | null>(
  methodOptions: MethodOptions<Params>
) {
  let fetcher = createFetch<Payload, Params>(methodOptions)
  return () => {
    let client = useClient()
    // @ts-ignore special case here, params may be passed into refetch instead of the hook.
    let refetch = useCallback(
      (params: Params) => {
        return fetcher(client, params)
      },
      [client]
    )
    return refetch
  }
}

export { createUseFetch, createUseFetchAction }
