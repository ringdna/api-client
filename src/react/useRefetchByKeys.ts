import { useCallback } from 'react'
import { useClient } from './context'
import { ResourceFlag } from '../constants'

function useRefetchByKeys(...keys: Array<string>) {
  let client = useClient()

  let refetchKeys = useCallback(
    () => {
      // @ts-ignore ts does not know of rIC
      requestIdleCallback(() => {
        // @TODO in the future we may want to keep a lazy index of keys so we can do this more efficiently
        client.cache.map.forEach(r => {
          keys.includes(r.methodOptions.key) &&
            client.cache.set(r.cacheKey, {
              ...r,
              flag: ResourceFlag.NeedsRefetch
            })
        })
      })
      // spread keys to avoid object identity changes in keys array
    },
    [client, ...keys] // eslint-disable-line
  )
  return refetchKeys
}

export default useRefetchByKeys
