import {
  DEFAULT_APP_SETTINGS,
  USER_FILES,
  getAttachmentBasePath,
  getRepositoryPath,
} from '../constants/app'
import { blobToBase64 } from '../lib/image'
import { calculateStorageUsageSummary } from '../lib/storage'
import { createId } from '../lib/utils'
import type {
  AllowedUserPublicEntry,
  AppSettings,
  AttachmentPhoto,
  MaintenanceRecordsDocument,
  OdometerHistory,
  ScheduledMaintenanceDocument,
  UserBundle,
  UserProfile,
} from '../types/models'
import {
  buildRawPublicUrl,
  deleteRepositoryFile,
  GitHubApiError,
  readPublicJson,
  readRepositoryJson,
  uploadRepositoryBlob,
  writeRepositoryJson,
} from './githubApi'

const getMaintenanceRecordedAt = (date: string) => {
  const timestamp = Date.parse(`${date}T12:00:00.000Z`)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const deriveCurrentOdometerKm = (
  odometerHistory: OdometerHistory,
  maintenanceRecords: MaintenanceRecordsDocument,
  fallbackOdometerKm: number,
) => {
  const latestEntry = odometerHistory.entries.reduce<OdometerHistory['entries'][number] | null>(
    (latest, entry) => {
      if (!latest) {
        return entry
      }
      return Date.parse(entry.recordedAt) >= Date.parse(latest.recordedAt) ? entry : latest
    },
    null,
  )
  if (latestEntry) {
    return latestEntry.odometerKm
  }

  const latestRecord =
    maintenanceRecords.records.reduce<MaintenanceRecordsDocument['records'][number] | null>(
      (latest, record) => {
        if (!latest) {
          return record
        }
        return getMaintenanceRecordedAt(record.date) >= getMaintenanceRecordedAt(latest.date)
          ? record
          : latest
      },
      null,
    )

  return latestRecord?.odometerKm ?? fallbackOdometerKm
}

const createEmptyProfile = (vehicleId: string): UserProfile => {
  const now = new Date().toISOString()
  return {
    vehicleId,
    nickname: vehicleId,
    manufacturer: '',
    modelName: '차량 정보 미입력',
    trim: '',
    modelYear: new Date().getFullYear(),
    fuelType: '미입력',
    purchaseDate: null,
    currentOdometerKm: 0,
    createdAt: now,
    updatedAt: now,
    notes: '',
  }
}

const createEmptyOdometerHistory = (vehicleId: string): OdometerHistory => ({
  vehicleId,
  currentOdometerKm: 0,
  entries: [],
  updatedAt: new Date().toISOString(),
})

const createEmptyRecords = (vehicleId: string): MaintenanceRecordsDocument => ({
  vehicleId,
  records: [],
  updatedAt: new Date().toISOString(),
})

const createEmptySchedules = (vehicleId: string): ScheduledMaintenanceDocument => ({
  vehicleId,
  items: [],
  updatedAt: new Date().toISOString(),
})

export const createEmptyUserBundle = (
  vehicleId: string,
  limitBytes = DEFAULT_APP_SETTINGS.storageLimitBytes,
): UserBundle => {
  const profile = createEmptyProfile(vehicleId)
  const odometerHistory = createEmptyOdometerHistory(vehicleId)
  const maintenanceRecords = createEmptyRecords(vehicleId)
  const scheduledMaintenance = createEmptySchedules(vehicleId)
  const storageSummary = calculateStorageUsageSummary(
    {
      profile,
      odometerHistory,
      maintenanceRecords,
      scheduledMaintenance,
    },
    limitBytes,
  )

  return {
    profile,
    odometerHistory,
    maintenanceRecords,
    scheduledMaintenance,
    storageSummary,
  }
}

const readPublicUserJson = async <T>(
  settings: AppSettings,
  vehicleId: string,
  fileName: string,
) => {
  const repositoryPath = getRepositoryPath(settings.dataRootPath, vehicleId, fileName)
  if (!settings.token) {
    return readPublicJson<T>(settings, repositoryPath)
  }

  try {
    return await readRepositoryJson<T>(settings, repositoryPath)
  } catch (error) {
    if (error instanceof GitHubApiError && error.code === 'not_found') {
      throw error
    }

    return readPublicJson<T>(settings, repositoryPath)
  }
}

export const readAllowedUsers = async (settings: AppSettings) =>
  !settings.token
    ? readPublicJson<AllowedUserPublicEntry[]>(settings, settings.allowedUsersPath)
    : readRepositoryJson<AllowedUserPublicEntry[]>(settings, settings.allowedUsersPath).catch(
        (error) => {
          if (error instanceof GitHubApiError && error.code === 'not_found') {
            throw error
          }
          return readPublicJson<AllowedUserPublicEntry[]>(
            settings,
            settings.allowedUsersPath,
          )
        },
      )

export const loadUserBundle = async (
  settings: AppSettings,
  vehicleId: string,
): Promise<UserBundle> => {
  const [profile, odometerHistory, maintenanceRecords, scheduledMaintenance] =
    await Promise.all([
      readPublicUserJson<UserProfile>(settings, vehicleId, USER_FILES.profile),
      readPublicUserJson<OdometerHistory>(settings, vehicleId, USER_FILES.odometerHistory),
      readPublicUserJson<MaintenanceRecordsDocument>(
        settings,
        vehicleId,
        USER_FILES.maintenanceRecords,
      ),
      readPublicUserJson<ScheduledMaintenanceDocument>(
        settings,
        vehicleId,
        USER_FILES.scheduledMaintenance,
      ),
    ])

  const normalizedCurrentOdometerKm = deriveCurrentOdometerKm(
    odometerHistory,
    maintenanceRecords,
    odometerHistory.currentOdometerKm || profile.currentOdometerKm,
  )

  const normalizedBundle = {
    profile: {
      ...profile,
      currentOdometerKm: normalizedCurrentOdometerKm,
    },
    odometerHistory: {
      ...odometerHistory,
      currentOdometerKm: normalizedCurrentOdometerKm,
    },
    maintenanceRecords,
    scheduledMaintenance,
  }

  return {
    ...normalizedBundle,
    storageSummary: calculateStorageUsageSummary(
      normalizedBundle,
      settings.storageLimitBytes,
    ),
  }
}

export const saveUserBundle = async (
  settings: AppSettings,
  bundle: UserBundle,
  messagePrefix: string,
) => {
  const basePath = settings.dataRootPath
  const vehicleId = bundle.profile.vehicleId

  await writeRepositoryJson(
    settings,
    getRepositoryPath(basePath, vehicleId, USER_FILES.profile),
    bundle.profile,
    `${messagePrefix}: update profile`,
  )
  await writeRepositoryJson(
    settings,
    getRepositoryPath(basePath, vehicleId, USER_FILES.odometerHistory),
    bundle.odometerHistory,
    `${messagePrefix}: update odometer history`,
  )
  await writeRepositoryJson(
    settings,
    getRepositoryPath(basePath, vehicleId, USER_FILES.maintenanceRecords),
    bundle.maintenanceRecords,
    `${messagePrefix}: update maintenance records`,
  )
  await writeRepositoryJson(
    settings,
    getRepositoryPath(basePath, vehicleId, USER_FILES.scheduledMaintenance),
    bundle.scheduledMaintenance,
    `${messagePrefix}: update scheduled maintenance`,
  )
  await writeRepositoryJson(
    settings,
    getRepositoryPath(basePath, vehicleId, USER_FILES.storageSummary),
    bundle.storageSummary,
    `${messagePrefix}: update storage summary`,
  )
}

const getFileExtension = (mimeType: string) => {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

export const uploadAttachment = async (
  settings: AppSettings,
  vehicleId: string,
  file: Blob,
  options: {
    fileName: string
    originalFileName: string
    kind: 'photos' | 'receipts'
    contentType: string
    width: number | null
    height: number | null
  },
): Promise<AttachmentPhoto> => {
  const extension = getFileExtension(options.contentType)
  const id = createId(options.kind === 'photos' ? 'photo' : 'receipt')
  const sanitizedFileName = options.fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_가-힣]/g, '-')
  const repositoryPath = `${getAttachmentBasePath(
    settings.dataRootPath,
    vehicleId,
    options.kind,
  )}/${id}-${sanitizedFileName}.${extension}`

  await uploadRepositoryBlob(
    settings,
    repositoryPath,
    await blobToBase64(file),
    `feat: upload ${options.kind} for ${vehicleId}`,
  )

  return {
    id,
    kind: options.kind === 'photos' ? 'photo' : 'receipt',
    fileName: `${sanitizedFileName}.${extension}`,
    originalFileName: options.originalFileName,
    contentType: options.contentType,
    bytes: file.size,
    width: options.width,
    height: options.height,
    optimized: true,
    uploadedAt: new Date().toISOString(),
    path: repositoryPath,
  }
}

export const getAttachmentUrl = (settings: AppSettings, attachmentPath: string) =>
  buildRawPublicUrl(settings, attachmentPath)

export const deleteAttachment = async (settings: AppSettings, attachmentPath: string) =>
  deleteRepositoryFile(settings, attachmentPath, 'chore: remove unused attachment')
