/**
 * @jest-environment jsdom
 */
import { createUseFetch } from '../react/createUseFetch'
import { ec } from './api'
import { renderFetchHook, createTestClient } from './helpers'
import { createFetch } from '../createFetch'

test('full flow', async () => {
  let useMockGet = createUseFetch<typeof ec.success.payload>({
    path: ec.success.path,
    key: '' + Math.random()
  })

  let { result, rerender } = await renderFetchHook(() => {
    return useMockGet()
  })
  let [payload, error, loading] = result.current

  expect(payload).toEqual(undefined)
  expect(error).toEqual(undefined)
  expect(loading).resolves.toBeTruthy()
  await loading
  rerender()
  let [payload2, error2, loading2] = result.current
  expect(payload2).toEqual(ec.success.payload)
  expect(error2).toEqual(undefined)
  expect(loading2).toEqual(false)
})

test('createFetch', async () => {
  let client = createTestClient()
  let fetchMockThing = createFetch<null>({
    path: ec.mockThing.path,
    key: '' + Math.random()
  })
  let mockThingResource = await fetchMockThing(client)
  expect(mockThingResource.success).toBeDefined()
  expect(mockThingResource.success?.payload).toEqual(ec.mockThing.payload)
})
