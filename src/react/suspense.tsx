import React, { createContext, Suspense, useMemo, useRef, useContext, SuspenseProps } from 'react'
import { ParamsGeneric, MethodOptions, ResourceGeneric } from '../constants'
import { HookOptions, createUseFetch } from './createUseFetch'

type PrimerProps = { usePrimer: () => void }
const Primer = function({ usePrimer }: PrimerProps) {
  usePrimer()
  return null
}

type SuspenseContainer = {
  set: (type: 'suspender' | 'primer', resource: ResourceGeneric) => void
}

export const SuspenseContext = createContext<SuspenseContainer>({
  set: () => {
    throw new Error('Suspense methods must be used within a ClientSuspenseBoundary')
  }
})

function ClientSuspenseBoundary({ usePrimer, children, ...suspenseProps }: PrimerProps & SuspenseProps) {
  let primed = useRef<Set<string>>(new Set())
  let suspended = useRef<Set<string>>(new Set())
  let value = useMemo(() => {
    return {
      set: (type: 'suspender' | 'primer', resource: ResourceGeneric) => {
        if (type === 'suspender' && !primed.current.has(resource.cacheKey) && !suspended.current.has(resource.cacheKey))
          console.error('client: cache miss', resource.cacheKey)
        type === 'suspender' ? suspended.current.add(resource.cacheKey) : primed.current.add(resource.cacheKey)
      }
    }
  }, [])
  return (
    <Suspense {...suspenseProps}>
      <SuspenseContext.Provider value={value}>
        <Primer usePrimer={usePrimer} />
        {children}
      </SuspenseContext.Provider>
    </Suspense>
  )
}

type SuspenseTuple<Payload, Params> = [ReturnType<typeof createUseFetch>, ReturnType<typeof createUseFetch>]

function createUseFetchSuspense<Payload, Params extends ParamsGeneric | void = void>(
  methodOptions: MethodOptions<Params>
) {
  let useFetch = createUseFetch<Payload, Params>(methodOptions)

  let useSuspender = (params: Params, options: HookOptions = {}) => {
    let state = useFetch(params, options)
    let suspenseContainer = useContext(SuspenseContext)
    state[4] && suspenseContainer.set('suspender', state[4])
    if (!state[0] && state[2]) {
      throw state[2]
    }
    return state
  }

  const usePrimer = (params: Params, options: HookOptions = {}) => {
    let suspenseContainer = useContext(SuspenseContext)
    let state = useFetch(params, options)
    state[4] && suspenseContainer.set('primer', state[4])
    return state
  }

  // @ts-ignore not sure why it is taking on unknown type for Payload
  return [useSuspender, usePrimer]
}

export { ClientSuspenseBoundary, createUseFetchSuspense }
