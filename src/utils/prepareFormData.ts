import { ParamsGeneric } from '../constants'

export default function prepareFormData(params: ParamsGeneric) {
  if (!params || !params.body) return
  let fd = new FormData()

  Object.entries(params.body).map(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => fd.append(`${key}[]`, String(v)))
    } else {
      fd.append(key, String(value))
    }
  })
  return fd
}
