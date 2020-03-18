import fetchMock from 'fetch-mock'
import { DefaultApi, ApiConfigs } from '../constants'

const basePath = 'http://test.com'

export const apis: ApiConfigs = {
  [DefaultApi]: {
    basePath,
    onRequestFail: () => {} // noop
  }
}
// endpoint config
export const ec = {
  success: {
    path: '/success',
    payload: {
      data: 'test'
    }
  },
  mockThing: {
    path: '/mock-thing',
    payload: {
      data: 'test'
    }
  }
}

Object.values(ec).forEach(v => {
  fetchMock.get(`${basePath}${v.path}`, {
    body: v.payload,
    headers: { 'content-type': 'application/json' }
  })
})
