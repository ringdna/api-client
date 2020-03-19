import {
  Executor,
  ApiConfigs,
  DefaultApi,
  RequestStage,
  RawResponse,
  RawCompletionPromise,
  RawError,
  ApiClient,
  ResourceGeneric
} from './constants'

/*
  returns a 'resource executor' which will use the resource to:
  - execute the fetch
  - update client cache
  - resolve resource on success
  - reject resource on fail or exception
*/
function createExecutor(apis: ApiConfigs): Executor {
  return async (resource: ResourceGeneric, client: ApiClient) => {
    if (resource.stage !== RequestStage.Latent)
      throw new Error('Api Client cannot execute a resouce which is not in latent stage')

    let { methodOptions, params } = resource

    let { headers: methodHeaders, method, path, extractHeaders } = methodOptions

    let apiConfig = apis[methodOptions.api || DefaultApi]
    if (!apiConfig) throw new Error('Invariant: missing api definition')

    let { query: paramsQuery, body: paramsBody, headers: paramsHeaders } = params || {}

    let p = new Promise<ResourceGeneric>(async (resolve, reject) => {
      let { handleResponse, prepareBody, authenticator } = apiConfig

      // @TODO revisit code, does it make sense to allow nested objects?
      let urlSearchParams = new URLSearchParams()
      if (paramsQuery) {
        Object.entries(paramsQuery).forEach(([key, param]) => {
          // undefined values will be omit, null values become empty string
          param !== undefined &&
            urlSearchParams.append(
              key,
              param === null ? '' : typeof param === 'object' ? JSON.stringify(param) : '' + param
            )
        })
      }

      let auth = authenticator && (await authenticator(client))

      let headers = Object.assign({}, apiConfig.headers, methodHeaders, paramsHeaders, auth && auth.headers)

      let body = prepareBody ? await prepareBody(resource.params) : JSON.stringify(paramsBody)

      let url = `${apiConfig.basePath}${path}${paramsQuery ? `?${urlSearchParams.toString()}` : ''}`
      if (apiConfig.debug) console.log(`## client fetch ${url}`, { headers, method, body })

      let responsePromise = fetch(url, {
        headers,
        method,
        body
      })

      // make a copy of the resource to be used once the request is complete
      let finalResource = { ...resource }
      let payload,
        response: Response | undefined = undefined
      try {
        // @TODO apply a fetchTimeout race to avoid broken fetch fail scenarios in RN https://github.com/facebook/react-native/issues/19709
        response = await responsePromise
        finalResource[RawResponse] = response

        payload = await (handleResponse
          ? handleResponse(response)
          : (response.headers.get('content-type')?.indexOf('application/json') ?? -1) >= 0
          ? response.json()
          : response.text())
        if (!response.ok) throw null
        // throw null to make clear in the catch this is just a bad status, not a js error
        else {
          ;(finalResource.stage = RequestStage.Success),
            (finalResource.success = {
              payload,
              status: response.status,
              timestamp: Date.now()
            })
          if (extractHeaders)
            // @ts-ignore ts not yet up to date on these es2019 methods
            finalResource.headers = Object.fromEntries(
              // @ts-ignore ts not yet up to date on these es2019 methods
              response.headers.entries()
            )
          resolve(finalResource)
        }
      } catch (err) {
        // duck type response by checking for status property
        finalResource[RawError] = err

        let status = response?.status ?? -1 // where -1 indicates it is not an http error.
        ;(finalResource.stage = RequestStage.Fail),
          (finalResource.fail = {
            message: err?.message || JSON.stringify(payload),
            payload,
            status,
            timestamp: Date.now(),
            // @TODO add retry logic based on this
            // @TODO make teminal configurable
            terminal: status >= 400 && status < 500
          })
        // @ts-ignore
        if (extractHeaders)
          // @ts-ignore ts not yet up to date on these es2019 methods
          finalResource.headers = Object.fromEntries(
            // @ts-ignore ts not yet up to date on these es2019 methods
            response.headers.entries()
          )
        apiConfig.onRequestFail(finalResource, client, err, response)
        reject(finalResource)
      } finally {
        client.cache.set(finalResource.cacheKey, finalResource)
      }
    })

    // set the resource into the cache with stage InFlight (note this happens sync before returning to the callsite)
    resource[RawCompletionPromise] = p
    resource.stage = RequestStage.InFlight
    client.cache.set(resource.cacheKey, resource)

    return p
  }
}

export { createExecutor }
