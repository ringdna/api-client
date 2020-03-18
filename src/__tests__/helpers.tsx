import React from 'react'
import { renderHook, act, RenderHookResult } from '@testing-library/react-hooks'
import { ClientProvider } from '../react/context'
import { apis } from './api'
import createWebCache from '../cache/createWebCache'
import createClient from '../createClient'
import { ApiClient } from '../constants'

// some gymnastics to make sure our async hook is wrapped in a async act, and still resolve the result
export async function renderFetchHook<R>(executor: (props: any) => R): Promise<RenderHookResult<any, R>> {
  let cache = createWebCache()
  let client = createClient(apis, cache)
  const wrapper = ({ children }: any) => {
    return <ClientProvider client={client}>{children}</ClientProvider>
  }

  return new Promise(async resolve => {
    // we need to await the cache ready to avoid confusing loading states
    // cache loading will be tested seperately
    await cache.readyPromise
    await act(async () => {
      resolve(renderHook(executor, { wrapper }))
    })
  })
}

export function createTestClient(): ApiClient {
  let cache = createWebCache()

  return createClient(apis, cache)
}
