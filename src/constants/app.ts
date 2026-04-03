import type { AppSettings } from '../types/models'

export const APP_NAME = 'Car Diary'
export const STORAGE_LIMIT_BYTES = 300 * 1024 * 1024
export const DEMO_VEHICLE_ID = '68보0632'
export const DEMO_PASSWORD = 'cardiary123!'

export const ROUTES = {
  home: '/',
  login: '/login',
  activate: '/activate',
  records: '/records',
  scheduled: '/scheduled',
  statistics: '/statistics',
  backups: '/backups',
  settings: '/settings',
} as const

export const LOCAL_STORAGE_KEYS = {
  appSettings: 'car-diary.settings',
  session: 'car-diary.session',
  recordDraft: 'car-diary.record-draft',
  scheduleDraft: 'car-diary.schedule-draft',
  importDraft: 'car-diary.import-draft',
} as const

const isLocalHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

export const DEFAULT_APP_SETTINGS: AppSettings = {
  repoOwner: 'car-diary',
  repoName: 'car-diary.github.io',
  branch: 'main',
  dataRootPath: 'public/repository-data',
  allowedUsersPath: 'public/data/allowed_users.json',
  token: '',
  storageLimitBytes: STORAGE_LIMIT_BYTES,
  theme: 'dark',
  preferLocalPublicFiles: isLocalHost,
}

export const USER_FILES = {
  profile: 'profile.json',
  odometerHistory: 'odometer-history.json',
  maintenanceRecords: 'maintenance-records.json',
  scheduledMaintenance: 'scheduled-maintenance.json',
  storageSummary: 'storage-summary.json',
} as const

export const getUserRootPath = (vehicleId: string) =>
  `${DEFAULT_APP_SETTINGS.dataRootPath}/users/${vehicleId}`

export const getRepositoryPath = (
  dataRootPath: string,
  vehicleId: string,
  fileName: string,
) => `${dataRootPath}/users/${vehicleId}/${fileName}`

export const getAttachmentBasePath = (
  dataRootPath: string,
  vehicleId: string,
  kind: 'photos' | 'receipts',
) => `${dataRootPath}/users/${vehicleId}/${kind}`

export const STORAGE_WARNING_THRESHOLD = 0.85
export const SOON_DUE_KM_THRESHOLD = 500
export const SOON_DUE_DAY_THRESHOLD = 7
