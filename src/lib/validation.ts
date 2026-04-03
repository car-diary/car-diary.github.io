const VEHICLE_ID_PATTERN = /^\d{2,3}[가-힣]\d{4}$/
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SINGLE_UPLOAD_BYTES = 15 * 1024 * 1024

export const isValidVehicleId = (value: string) =>
  VEHICLE_ID_PATTERN.test(value.trim())

export const validateVehicleId = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return '차량번호를 입력하세요.'
  if (!isValidVehicleId(normalized)) {
    return '차량번호 형식이 올바르지 않습니다. 예: 68보0632, 123가4567'
  }
  return null
}

export const validatePassword = (value: string) => {
  if (value.trim().length < 8) {
    return '비밀번호는 8자 이상으로 입력하세요.'
  }
  return null
}

export const ensureNonNegativeNumber = (value: number) =>
  Number.isFinite(value) && value >= 0

export const validateAttachmentFile = (file: File) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'JPG, PNG, WEBP 이미지만 업로드할 수 있습니다.'
  }
  if (file.size > MAX_SINGLE_UPLOAD_BYTES) {
    return '한 장당 15MB 이하 파일만 업로드할 수 있습니다.'
  }
  return null
}

export const calculateTotalCost = (partsCost: number, laborCost: number) =>
  Math.max(0, Number(partsCost) + Number(laborCost))
