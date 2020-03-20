import { ParamsGeneric, CacheType, MethodOptions, Resource, Loading, Fail } from '../constants'
import { HookOptions, createUseFetch } from './createUseFetch'
import { useMemo, useReducer, useRef } from 'react'
import { inferCacheKey } from '../inferCacheKey'
import { useClient } from './context'

type PagerOptions<Payload, Params> = {
  getCursor: (page: number, resource?: Resource<Payload, Params>) => ParamsGeneric
  isTerminal: (resource: Resource<Payload, Params>) => boolean
}

type Pager<Payload, Params> = {
  next: () => Promise<Resource<Payload, Params>>
  reset: () => Promise<Resource<Payload, Params>>
  terminal: boolean
}

type PagedReturnTuple<Payload, Params> = [
  Payload | undefined,
  Fail | undefined,
  Loading<Payload, Params>,
  Pager<Payload, Params>,
  Array<Resource<Payload, Params> | void>
]

// type as any to avoid void property access issues
function applyCursor(params: any, cursorParams: any): ParamsGeneric {
  return {
    ...params,
    query: {
      ...params?.query,
      ...cursorParams?.query
    }
  }
}
// @TODO omit nonsensical options from methodOptions like independent and cacheType
function createUsePagedFetch<Payload, Params extends ParamsGeneric = void | null>(
  methodOptions: MethodOptions<Params>,
  pagerOptions: PagerOptions<Payload, Params>
) {
  let useFetch = createUseFetch<Payload, Params>(methodOptions)
  return (params: Params, hookOptions: HookOptions = {}): PagedReturnTuple<Payload, Params> => {
    const [, forceRender] = useReducer(s => s + 1, 0) // taken from react-redux https://github.com/reduxjs/react-redux/blob/master/src/hooks/useSelector.js#L46

    // to avoid referential inequality issues, stringify params
    // @TODO can we avoid similar redundant work done in useFetch?
    const paramsString = useMemo(() => {
      return JSON.stringify(params)
    }, [params])

    // setup refs
    let lastParamsStringRef = useRef(paramsString)
    let activeRequest = useRef<Promise<Resource<Payload, Params>> | void>()
    let terminal = useRef(false)
    let page = useRef(0)

    // reset everything if params change
    if (lastParamsStringRef.current !== paramsString) {
      lastParamsStringRef.current = paramsString
      page.current = 0
      terminal.current = false
    }

    let client = useClient()
    let { cache } = client

    let baseCacheKey = useMemo(() => {
      return inferCacheKey(methodOptions.api, methodOptions.key, CacheType.Disk, false, paramsString + String(0))
    }, [paramsString])

    let baseAppliedParams = useMemo(() => {
      let cursor = pagerOptions.getCursor(0)
      return applyCursor(params, cursor)
    }, [paramsString]) // eslint-disable-line

    // @TODO get rid of the Params coercion
    let [, , , refetch, firstPage] = useFetch(baseAppliedParams as Params, {
      ...hookOptions,
      cacheKey: baseCacheKey
    })

    let pages = [firstPage]
    let lastPage = pages[page.current] || undefined
    for (let i = 1; i <= page.current; i++) {
      let cacheKey = inferCacheKey(
        methodOptions.api,
        methodOptions.key,
        CacheType.Memory,
        false,
        paramsString + String(i)
      )
      let resource = cache.get(cacheKey) as Resource<Payload, Params>
      pages[i] = resource
    }

    let pager = useMemo(() => {
      let next = () => {
        if (activeRequest.current) return activeRequest.current
        page.current++
        let cacheKey = inferCacheKey(
          methodOptions.api,
          methodOptions.key,
          CacheType.Memory,
          false,
          paramsString + String(page.current)
        )
        let cursor = pagerOptions.getCursor(page.current, lastPage)

        // @TODO get rid of the type coercion
        let request = refetch(applyCursor(params, cursor) as Params, cacheKey)
        activeRequest.current = request
        request.then(resource => {
          terminal.current = pagerOptions.isTerminal(resource)
        })
        request.finally(() => {
          activeRequest.current = undefined
          forceRender()
        })
        return request
      }
      let reset = () => {
        page.current = 0
        terminal.current = false
        let request = refetch()
        activeRequest.current = request
        request.finally(() => {
          // @NOTE we dont force render here because the base useFetch will handle that
          activeRequest.current = undefined
        })
        forceRender()
        return request
      }

      return {
        next,
        reset,
        terminal: terminal.current
      }
    }, [paramsString, refetch, lastPage, terminal.current]) // eslint-disable-line

    // @TODO support non array payloads, perhaps pagerOptions.merge()
    // @ts-ignore ts doesnt know about flatMap
    let mergedPayload = pages.flatMap(page => page?.success?.payload) as Payload

    return [mergedPayload, lastPage?.fail, activeRequest.current || false, pager, pages]
  }
}

export { createUsePagedFetch }
