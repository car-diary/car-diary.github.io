import { createContext, useContext } from 'react'

import type {
  AllowedUserPublicEntry,
  AppSettings,
  DashboardSummary,
  ImportPayload,
  MaintenanceRecordDraft,
  OdometerUpdateInput,
  ScheduledMaintenanceDraft,
  SessionState,
  StatisticsSnapshot,
  ToastMessage,
  UserBundle,
} from '../types/models'

export interface AppContextValue {
  settings: AppSettings
  session: SessionState | null
  allowedUsers: AllowedUserPublicEntry[]
  userBundle: UserBundle | null
  dashboardSummary: DashboardSummary | null
  statistics: StatisticsSnapshot | null
  isBootstrapping: boolean
  isSaving: boolean
  isReadOnly: boolean
  toasts: ToastMessage[]
  saveSettings: (nextSettings: Partial<AppSettings>) => void
  refreshAllowedUsers: () => Promise<void>
  login: (vehicleId: string) => Promise<void>
  logout: () => void
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void
  dismissToast: (toastId: string) => void
  updateOdometer: (input: OdometerUpdateInput) => Promise<void>
  saveMaintenanceRecord: (draft: MaintenanceRecordDraft) => Promise<void>
  deleteMaintenanceRecord: (recordId: string) => Promise<void>
  saveScheduledMaintenance: (draft: ScheduledMaintenanceDraft) => Promise<void>
  deleteScheduledMaintenance: (scheduleId: string) => Promise<void>
  markScheduleCompleted: (scheduleId: string, recordId: string) => Promise<void>
  importData: (payload: ImportPayload) => Promise<void>
  exportData: () => ImportPayload | null
  testGitHubConnection: () => Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('AppContext가 초기화되지 않았습니다.')
  }
  return context
}
