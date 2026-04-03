export interface OptimizedImageResult {
  blob: Blob
  width: number
  height: number
  previewUrl: string
}

const fileToImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽지 못했습니다.'))
    }
    image.src = url
  })

export const optimizeImageFile = async (
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<OptimizedImageResult> => {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = options
  const image = await fileToImage(file)
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  const width = Math.round(image.width * ratio)
  const height = Math.round(image.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('이미지 압축 캔버스를 생성하지 못했습니다.')
  }
  context.drawImage(image, 0, 0, width, height)
  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('이미지 압축에 실패했습니다.'))
          return
        }
        resolve(result)
      },
      mimeType,
      quality,
    )
  })
  return {
    blob,
    width,
    height,
    previewUrl: URL.createObjectURL(blob),
  }
}

export const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('이미지 인코딩에 실패했습니다.'))
        return
      }
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'))
    reader.readAsDataURL(blob)
  })
