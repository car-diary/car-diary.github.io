export type PriorityLevel = 'low' | 'normal' | 'high'
export type AlertTone = 'danger' | 'warn' | 'info'
export type AttachmentKind = 'photo' | 'receipt' | 'thumbnail'
export type RecordSortKey = 'date' | 'cost' | 'odometer'

export interface AllowedUserBuildSource {
  vehicleId: string
  sourceLine: number
  rawLine: string
}

export interface AllowedUserPublicEntry {
  vehicleId: string
  displayName: string
  profilePath: string
  notes: string | null
}

export interface AllowedUsersMeta {
  generatedAt: string
  totalEntries: number
  sourceDescription: string
}

export interface AppSettings {
  repoOwner: string
  repoName: string
  branch: string
  dataRootPath: string
  allowedUsersPath: string
  token: string
  storageLimitBytes: number
  theme: 'dark'
  preferLocalPublicFiles: boolean
}

export interface SessionState {
  vehicleId: string
  loggedInAt: string
}

export interface UserProfile {
  vehicleId: string
  nickname: string
  manufacturer: string
  modelName: string
  trim: string
  modelYear: number
  fuelType: string
  purchaseDate: string | null
  currentOdometerKm: number
  createdAt: string
  updatedAt: string
  notes: string
}

export interface OdometerHistoryEntry {
  id: string
  recordedAt: string
  odometerKm: number
  source: 'manual' | 'maintenance' | 'import'
  note: string
}

export interface OdometerHistory {
  vehicleId: string
  currentOdometerKm: number
  entries: OdometerHistoryEntry[]
  updatedAt: string
}

export interface MaintenanceRecordItem {
  code: string
  categoryKey: string
  label: string
  isCustom: boolean
}

export interface AttachmentPhoto {
  id: string
  kind: AttachmentKind
  fileName: string
  originalFileName: string
  contentType: string
  bytes: number
  width: number | null
  height: number | null
  optimized: boolean
  uploadedAt: string
  path: string
}

export interface MaintenanceRecord {
  id: string
  date: string
  odometerKm: number
  items: MaintenanceRecordItem[]
  customItemsText: string
  shopName: string
  partsCost: number
  laborCost: number
  totalCost: number
  notes: string
  photos: AttachmentPhoto[]
  receiptPhotos: AttachmentPhoto[]
  representativePhotoId: string | null
  scheduledSourceId: string | null
  createdAt: string
  updatedAt: string
}

export interface MaintenanceRecordsDocument {
  vehicleId: string
  records: MaintenanceRecord[]
  updatedAt: string
}

export interface ScheduledMaintenance {
  id: string
  title: string
  items: MaintenanceRecordItem[]
  scheduledDate: string | null
  targetOdometerKm: number | null
  expectedCost: number | null
  priority: PriorityLevel
  notes: string
  status: 'pending' | 'completed'
  createdAt: string
  updatedAt: string
  completedAt: string | null
  completedByRecordId: string | null
}

export interface ScheduledMaintenanceDocument {
  vehicleId: string
  items: ScheduledMaintenance[]
  updatedAt: string
}

export interface StorageBreakdownItem {
  path: string
  bytes: number
  kind: 'json' | AttachmentKind
}

export interface StorageUsageSummary {
  vehicleId: string
  limitBytes: number
  usedBytes: number
  jsonBytes: number
  attachmentBytes: number
  percentUsed: number
  fileBreakdown: StorageBreakdownItem[]
  updatedAt: string
}

export interface UserBundle {
  profile: UserProfile
  odometerHistory: OdometerHistory
  maintenanceRecords: MaintenanceRecordsDocument
  scheduledMaintenance: ScheduledMaintenanceDocument
  storageSummary: StorageUsageSummary
}

export interface DashboardAlert {
  id: string
  tone: AlertTone
  title: string
  description: string
  scheduleId: string
}

export interface DashboardSummary {
  monthlySpend: number
  yearlySpend: number
  latestOdometerKm: number
  maintenanceCountThisYear: number
  pendingSchedules: number
  urgentAlerts: DashboardAlert[]
}

export interface MonthlyTrendPoint {
  month: string
  label: string
  distanceKm: number
  spend: number
  recordCount: number
}

export interface AnnualMetricPoint {
  year: string
  averageMileageKm: number
  averageSpend: number
}

export interface StatisticsSnapshot {
  annualMetrics: AnnualMetricPoint[]
  monthlyTrend: MonthlyTrendPoint[]
  spendingByItem: { name: string; value: number }[]
  recordCountByItem: { name: string; count: number }[]
  topSpendItems: { name: string; value: number }[]
  recentItemSnapshots: {
    itemLabel: string
    lastDate: string | null
    lastOdometerKm: number | null
  }[]
  estimatedCostPerKm: number
}

export interface ToastMessage {
  id: string
  tone: 'success' | 'error' | 'info'
  title: string
  description?: string
}

export interface MaintenanceRecordDraft {
  id?: string
  date: string
  odometerKm: number
  allowLowerOdometer?: boolean
  selectedItemCodes: string[]
  customItemsText: string
  shopName: string
  partsCost: number
  laborCost: number
  notes: string
  representativePhotoId: string | null
  existingPhotos: AttachmentPhoto[]
  existingReceipts: AttachmentPhoto[]
  newPhotos: File[]
  newReceipts: File[]
  scheduledSourceId: string | null
}

export interface ScheduledMaintenanceDraft {
  id?: string
  title: string
  selectedItemCodes: string[]
  scheduledDate: string
  targetOdometerKm: string
  expectedCost: string
  priority: PriorityLevel
  notes: string
}

export interface OdometerUpdateInput {
  odometerKm: number
  note: string
  force: boolean
}

export interface ImportPayload {
  profile: UserProfile
  odometerHistory: OdometerHistory
  maintenanceRecords: MaintenanceRecordsDocument
  scheduledMaintenance: ScheduledMaintenanceDocument
  storageSummary?: StorageUsageSummary
}
