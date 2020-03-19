import { ClientCache } from './cache/ClientCache'

export const RawError: unique symbol = Symbol('get-error')
export const RawResponse: unique symbol = Symbol('get-response')
export const RawCompletionPromise: unique symbol = Symbol('get-completion-promise')

export type JsonValue = string | number | boolean | Date | JsonObject | JsonArray | void
export type JsonArray = Array<JsonValue>
export type JsonObject = {
  [x: string]: JsonValue
  // special rules for these two properties on RequestAction
  [RawError]?: Function
  [RawResponse]?: Function
  [RawCompletionPromise]?: Function
}

export enum HttpMethods {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Delete = 'DELETE'
}

export enum CacheType {
  Memory = 'memory',
  Disk = 'disk'
}

export enum RequestStage {
  InFlight = 'in-flight',
  Success = 'success',
  Fail = 'fail',
  Latent = 'latent'
}

export type ParamsGeneric = {
  body?: any
  json?: JsonObject
  query?: JsonObject
  headers?: JsonObject
  meta?: JsonObject
} | null | void

type Authenticator = (client: ApiClient) => Promise<void | { headers: JsonObject }> | void | { headers: JsonObject }
export type OnRequestFail = (resource: ResourceGeneric, client: ApiClient, error?: Error, response?: Response) => void
export type ApiConfig = {
  basePath: string
  onRequestFail: OnRequestFail
  headers?: { [key: string]: string }
  authenticator?: Authenticator
  debug?: boolean
  prepareBody?: (params: ParamsGeneric) => any
  handleResponse?: (response: Response) => any
}

export type ApiConfigs = { [key: string]: ApiConfig }

export const DefaultApi = 'default-api'

export type MethodOptions<Params extends ParamsGeneric | void> = {
  path: string | ((params: Params) => string)
  key: string
  api?: string
  refetchInterval?: number // ms after which request will refetch
  method?: HttpMethods // default to get
  cache?: CacheType // default to memory
  independent?: boolean // default to false for GET, true for others
  headers?: { [key: string]: string }
  extractHeaders?: true
}

export type MethodOptionsGeneric = MethodOptions<ParamsGeneric>
export type MethodOptionsRealized = Omit<MethodOptions<ParamsGeneric>, 'path'> & {
  path: string
  independent: boolean
}

export type Fail = {
  status: number
  message: string
  // @TODO should we allow fail payload to be typed with generics?
  payload?: any
  headers?: { [key: string]: string }
  timestamp: number
  terminal: boolean
}

export type Resource<Payload, Params> = {
  methodOptions: MethodOptionsRealized
  params: Params
  timestamp: number
  stage: RequestStage
  cacheKey: string
  flag: ResourceFlag
  success?: {
    status: number
    payload: Payload
    headers?: { [key: string]: string }
    timestamp: number
  }
  fail?: Fail
  // @NOTE these methods will not serialize and thus will only exist for actions that originate from the current process
  [RawResponse]?: Response
  [RawCompletionPromise]?: Promise<Resource<Payload, Params>>
  [RawError]?: Error
}

export type ResourceGeneric = Resource<any, ParamsGeneric>
export enum ResourceFlag {
  Stable = 0,
  NeedsRefetch = 1
}
export type Executor = (resource: ResourceGeneric, client: ApiClient) => Promise<ResourceGeneric>
export type ApiClient = {
  execute: Executor
  cache: ClientCache
}

export type Loading<Payload, Params> = Promise<Resource<Payload, Params>> | false
export type Refetch<Payload, Params> = (
  overrideParams?: Params,
  overrideCacheKey?: string
) => Promise<Resource<Payload, Params>>
export type ReturnTuple<Payload, Params> = [
  Payload | undefined,
  Fail | undefined,
  Loading<Payload, Params>,
  Refetch<Payload, Params>,
  Resource<Payload, Params> | undefined
]

type StringOrNull = string | null
export type Storage = {
  getItem: (key: string) => Promise<StringOrNull>
  setItem: (key: string, item: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}
export type CacheStrategy = (cache: ClientCache) => void | (() => void)
