/*
  Wrapper for localStorage that
  - Promisify's the api
  - Throws a predictable error if storage fails or is not available
  */

type StringOrNull = string | null
const LocalStorage = {
  getItem: (key: string): Promise<StringOrNull> => {
    return new Promise(resolve => {
      resolve(localStorage.getItem(key))
    })
  },
  setItem: (key: string, item: string): Promise<void> => {
    return new Promise(resolve => {
      resolve(localStorage.setItem(key, item))
    })
  },
  removeItem: (key: string): Promise<void> => {
    return new Promise(resolve => {
      resolve(localStorage.removeItem(key))
    })
  }
}

export { LocalStorage }
