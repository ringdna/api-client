# Api Client
A hooks based api client built for composition.

## Features
- Resource Persistence
- Resource Sharing
- Pluggable Cache Management
- Offline/Optimistic Primatives
- Hook Factories
- Paging Support
- TypeScript

## Concepts
To use this library you will need to understand and implement the following:

#### Api Config
Config to determine the behavior of each api. Methods can specify which api they belong to.
```ts
import { DefaultApi, ApiConfigs } from 'api-client/src/constants'

const onRequestFail = (request, resource) =>
  console.log('Request Fail', request, resource)

const apis: ApiConfigs = {
  [DefaultApi]: {
    headers: async () => ({
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
      }
    }),
    onRequestFail,
    basePath: config.apiPath,
    debug: true
  },
}
```

#### Cache Strategy
Cache strategies are actually just methods that are given access to the cache, and then set up relevant logic to manage it. For example `createResourceCountStrategy` sets a max number of cached requests, and culls the excess at startup.
```ts
import { createResourceCountStrategy } from 'api-client/src/cache/resourceCountStrategy'

const cacheStrategy = createResourceCountStrategy(500)
```

#### Api Provider
Create the client and provide it via context.
```tsx
  <ApiProvider apis={apis} cacheStrategy={cacheStrategy}>
    {props.children}
  </ApiProvider>
```

#### Method Factories
Method factories are used to create fetch hooks. Factories allow us to prebind the method config and domain types, resulting in much cleaner component code.
```ts
import { createUseFetch, createUseFetchAction } from 'opticlient/src/react/createUseFetch'

type Payload = {
  id: number
  name: string
}

type Params = {
  body: {
    name: number
  }
}


// this hook will return a execute method
export const useProfilePostAction = createUseFetchAction<Payload>({
  key: 'post-user-profile',
  method: HttpMethods.Post,
  path: '/user',
})

// this hook will execute the request automatically and return the results
export const useProfileGet = createUseFetch<Payload, Params>({
  key: 'get-user-profile',
  path: '/user',
})
```

#### Method Factories, with params & dynamic paths
```ts
import { createUseFetch } from 'opticlient/src/react/createUseFetch'

type Payload = {
  id: number
  name: string
}

type Params = {
  query: {
    userId: number
  }
}

// this hook will return a execute method
export const useProfileGet = createUseFetch<Payload, Params>({
  key: 'post-user-profile',
  path: params => `/user/${params.query.userId}`,
})
```

#### Using Method Hooks
Method hooks return a tuple `[payload, error, loading, refetch, resource]`. Since a resource may be cached, its possible to simultaneously have an old cached payload and an error or loading state for a newer request.
```tsx
import { useProfilePostAction, useProfileGet } from './api'

export default function UserProfile(){
  let [user, error, loading, refetch] = useProfileGet()
  if (!user && loading) return 'loading...'
  if (!user && error) return 'an error occured'
  return (
    <div>
      <span>{user.name}</span>
      <button onClick={refetch}>Reload</button>
    </div>
  )
}

export default function UserProfileUpdater(){
  let profilePostAction = useProfilePostAction()
  let updateName = () => {
    profilePostAction({ body: { name: Math.random() } })
  }
  return (
    <div>
      <button onClick={updateName}>Update Name</button>
    </div>
  )
}
```

#### Caching
Caching is a complicated topic. Once caching is enabled everything becomes stateful and consequently more complex. However it also enables snappy interactions, instant feedback and offline usability.
```ts
export const useProfileGet = createUseFetch<Payload, Params>({
  key: 'get-user-profile',
  path: '/user',
  cache: CacheTypes.Disk, // Persist this resource. It will automatically rehydrate on restart.
  independent: true, // True -> every hook call site will be independent, fire its own request, and receive its own resource.
})
```

#### Other Method Config: refetchInterval, api
```ts
export const useProfileGet = createUseFetch<Payload, Params>({
  key: 'get-user-profile',
  path: '/user',
  api: 'user-api', // this need to match the key from the apiConfigs object
  refetchInterval: 500, // ms afer which the request should be rerun for fresh data.
})
```

#### Suspense
The client is suspense ready. In order to prevent "waterfall loading states" opticlient provides a mechanism for priming requests at the suspense boundary.
```tsx

import { createUseFetchSuspense } from 'api-client/src/react/suspense'
import { Profile } from './types'

let [useProfileGetSuspender, useProfileGetPrimer] = createUseFetchSuspense<Profile>({
  key: 'profile-suspense',
  path: '/user',
})

let [useSomeOtherGetSuspender, useSomeOtherGetPrimer] = createUseFetchSuspense<Profile>({
  key: 'some-other-suspense',
  path: '/some-other',
  cache: CacheType.Memory
})


function usePrimer() {
  useProfileGetPrimer()
  useSomeOtherGetPrimer()
}
const SuspenseScreen = () => {
  return (
    <ClientSuspenseBoundary usePrimer={usePrimer} fallback={'loading...'}>
      <h2>Suspense Demo:</h2>
      <p>This page fetches two routes, and suspends execution until the data is available.</p>
      <UserProfile />
    </ClientSuspenseBoundary>
  )
}

function UserProfile() {
  let [user] = useProfileGetSuspender()
  let [someOtherThing] = useSomeOtherGetSuspender()
  return (
    <div>
      <pre>{JSON.stringify(user)}</pre>
      <pre>{JSON.stringify(someOtherThing)}</pre>
    </div>
  )
}

```
#### Paging
Paging support can be added via `createUsePagedFetch`
```tsx
import { createUsePagedFetch } from 'api-client/src/react/pagedMethodFactory'
import { Resource } from 'api-client/src/constants'

type PagedProfiles = Array<{
  id: number
  name: string
}>

type PagedProfileParams = {
  query: { limit?: number }
}
let pagerOptions = {
  getCursor(page: number) {
    return {
      query: {
        page
      }
    }
  },
  isTerminal(resource: Resource<PagedProfiles, PagedProfileParams>) {
    return resource.success?.payload?.length < (resource.params?.query?._limit || 10)
  }
}
let usePagedProfilesGet = createUsePagedFetch<PagedProfiles, PagedProfileParams>(
  {
    key: 'paged-profiles',
    path: '/users',
  },
  pagerOptions
)

function ProfilesList () {
  // where data is the concatenated array of each page payload
  let [data, error, loading, pager, pages] = usePagedProfilesGet()

  return (
    <div>
      <button type="button" onClick={pager.next}>
        Next Page
      </button>
      <button type="button" onClick={pager.reset}>
        Reset Pages (pages: {pages.length}, terminal: {String(pager.terminal)})
      </button>
    </div>
  )
}
```

#### Offline / Optimistic
There is no official helpers for this yet, but the primatives all exist and can be used. Generally it works by accessing the request cache, pulling out whatever info is needed and returning a modified resource.

roughly something like:
```tsx
function ProfileOptimistic () {
  let client = useContext(ApiClient)

  let [profile = {},,, profileResource] = useProfileGet()

  client.cache.data.forEach(resource => {
    if(resource.key === 'post-profile' && resource.timestamp > profileResource.timestamp) {
      profile.name = resource.params.body.name
    }
  })

  return <div>{profile.name}</div>
}
```

## Api
The api is still subject to change. Consult typescript for complete api definitions.
