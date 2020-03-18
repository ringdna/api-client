import React, { createContext, useContext, ReactNode } from 'react'
import { ApiClient } from '../constants'

let ClientContext = createContext<ApiClient | void>(undefined)
let { Provider } = ClientContext

type ProviderProps = {
  children: ReactNode
  client: ApiClient
}

function ClientProvider({ client, children }: ProviderProps) {
  if (process.env.NODE_ENV !== 'production') {
    // @TODO consider supporting hot update of apis / cache
    // @ts-ignore ts does not know about window
    if (window && window._client && window._client !== client)
      console.error(
        'api-client: the client changed between renders. Hot client updates are not supported at this time.'
      )
  }

  // @ts-ignore ts does not know about window
  if (window) window._client = client

  return <Provider value={client}>{children}</Provider>
}

function useClient() {
  let client = useContext(ClientContext)
  if (!client) throw new Error('useClient must be a descendent in ApiProvider')
  return client
}

export { ClientProvider, useClient }
