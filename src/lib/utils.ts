import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

export const createId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

export const safeJsonParse = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text)
}

export const downloadTextFile = (
  fileName: string,
  content: string,
  contentType = 'application/json',
  withBom = false,
) => {
  const prefix = withBom ? '\uFEFF' : ''
  const blob = new Blob([prefix, content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export const readTextFile = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const stripBom = (value: string) => value.replace(/^\uFEFF/, '')
  const utf8Text = stripBom(new TextDecoder('utf-8').decode(buffer))
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text
  }

  try {
    return stripBom(new TextDecoder('euc-kr').decode(buffer))
  } catch {
    return utf8Text
  }
}

export const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0)
