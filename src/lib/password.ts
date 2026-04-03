const encoder = new TextEncoder()

const base64FromBytes = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))

export const generateSalt = () => base64FromBytes(crypto.getRandomValues(new Uint8Array(16)))

export const hashPassword = async (
  vehicleId: string,
  password: string,
  salt: string,
) => {
  const payload = `${vehicleId}:${password}:${salt}`
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload))
  return base64FromBytes(new Uint8Array(digest))
}

export const verifyPassword = async (
  vehicleId: string,
  password: string,
  salt: string | null,
  expectedHash: string | null,
) => {
  if (!salt || !expectedHash) return false
  const actualHash = await hashPassword(vehicleId, password, salt)
  return actualHash === expectedHash
}
