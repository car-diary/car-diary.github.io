import { safeJsonParse } from './utils'

export const getVehicleScopedDraftKey = (baseKey: string, vehicleId: string) =>
  `${baseKey}.${vehicleId}`

export const readVehicleScopedDraft = <T extends object>(
  baseKey: string,
  vehicleId: string,
  fallback: Partial<T> = {},
) => {
  const scopedKey = getVehicleScopedDraftKey(baseKey, vehicleId)
  const scopedValue = localStorage.getItem(scopedKey)

  if (scopedValue) {
    return safeJsonParse<Partial<T>>(scopedValue, fallback)
  }

  const legacyValue = localStorage.getItem(baseKey)
  if (!legacyValue) {
    return fallback
  }

  localStorage.setItem(scopedKey, legacyValue)
  localStorage.removeItem(baseKey)
  return safeJsonParse<Partial<T>>(legacyValue, fallback)
}

export const writeVehicleScopedDraft = (
  baseKey: string,
  vehicleId: string,
  value: unknown,
) => {
  localStorage.setItem(
    getVehicleScopedDraftKey(baseKey, vehicleId),
    JSON.stringify(value),
  )
}

export const clearLegacyDraft = (baseKey: string) => {
  localStorage.removeItem(baseKey)
}
