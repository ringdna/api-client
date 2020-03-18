import { ApiConfigs, ApiClient } from './constants'
import { ClientCache } from './cache/ClientCache'
import { createExecutor } from './createExecutor'

export default function createClient(apis: ApiConfigs, cache: ClientCache): ApiClient {
  return {
    execute: createExecutor(apis),
    cache
  }
}
