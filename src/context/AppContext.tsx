import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { parseISO } from 'date-fns'

import { DEFAULT_APP_SETTINGS, LOCAL_STORAGE_KEYS } from '../constants/app'
import { MAINTENANCE_ITEM_LOOKUP } from '../constants/maintenanceItems'
import { optimizeImageFile } from '../lib/image'
import { generateSalt, hashPassword, verifyPassword } from '../lib/password'
import { buildDashboardSummary, buildStatisticsSnapshot } from '../lib/selectors'
import { calculateStorageUsageSummary } from '../lib/storage'
import { createId, safeJsonParse } from '../lib/utils'
import {
  calculateTotalCost,
  validateAttachmentFile,
  validatePassword,
} from '../lib/validation'
import {
  createEmptyUserBundle,
  deleteAttachment,
  loadUserBundle,
  readAllowedUsers,
  saveAllowedUsers,
  saveUserBundle,
  uploadAttachment,
} from '../services/carDiaryRepository'
import { GitHubApiError, testRepositoryAccess } from '../services/githubApi'
import type {
  AllowedUserPublicEntry,
  AppSettings,
  DashboardSummary,
  ImportPayload,
  MaintenanceRecord,
  MaintenanceRecordDraft,
  MaintenanceRecordItem,
  OdometerHistoryEntry,
  OdometerUpdateInput,
  ScheduledMaintenance,
  ScheduledMaintenanceDraft,
  SessionState,
  StatisticsSnapshot,
  ToastMessage,
  UserBundle,
} from '../types/models'

interface AppContextValue {
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
  login: (vehicleId: string, password: string) => Promise<void>
  activateAccount: (vehicleId: string, password: string) => Promise<void>
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

const AppContext = createContext<AppContextValue | null>(null)

const persistSettings = (settings: AppSettings) => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.appSettings, JSON.stringify(settings))
}

const persistSession = (session: SessionState | null) => {
  if (!session) {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.session)
    return
  }
  localStorage.setItem(LOCAL_STORAGE_KEYS.session, JSON.stringify(session))
}

const readLocalSettings = (): AppSettings => {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.appSettings)
  return raw
    ? { ...DEFAULT_APP_SETTINGS, ...safeJsonParse<Partial<AppSettings>>(raw, {}) }
    : DEFAULT_APP_SETTINGS
}

const readLocalSession = (): SessionState | null => {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.session)
  return raw ? safeJsonParse<SessionState | null>(raw, null) : null
}

const mapCodesToItems = (
  codes: string[],
  customItemsText: string,
): MaintenanceRecordItem[] =>
  codes.map((code) => {
    const lookup = MAINTENANCE_ITEM_LOOKUP.get(code)
    if (!lookup) {
      return {
        code,
        categoryKey: 'consumables',
        label: customItemsText || '기타 직접입력',
        isCustom: true,
      }
    }
    const isCustom = lookup.label === '기타 직접입력'
    return {
      code,
      categoryKey: lookup.categoryKey,
      label: isCustom && customItemsText ? customItemsText : lookup.label,
      isCustom,
    }
  })

const sortRecords = (records: MaintenanceRecord[]) =>
  [...records].sort((left, right) => {
    const dateDiff = parseISO(right.date).getTime() - parseISO(left.date).getTime()
    if (dateDiff !== 0) return dateDiff
    return right.updatedAt.localeCompare(left.updatedAt)
  })

export const AppProvider = ({ children }: PropsWithChildren) => {
  const [settings, setSettings] = useState<AppSettings>(readLocalSettings)
  const [session, setSession] = useState<SessionState | null>(readLocalSession)
  const [allowedUsers, setAllowedUsers] = useState<AllowedUserPublicEntry[]>([])
  const [userBundle, setUserBundle] = useState<UserBundle | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const toastTimeouts = useRef<number[]>([])

  const isReadOnly = !settings.token

  const pushToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = createId('toast')
    setToasts((current) => [...current, { ...toast, id }])
    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 4200)
    toastTimeouts.current.push(timeoutId)
  }

  const dismissToast = (toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }

  const refreshAllowedUsers = async () => {
    const entries = await readAllowedUsers(settings)
    setAllowedUsers(entries)
  }

  useEffect(() => {
    persistSettings(settings)
  }, [settings])

  useEffect(
    () => () => {
      toastTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    },
    [],
  )

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      setIsBootstrapping(true)
      try {
        const entries = await readAllowedUsers(settings)
        if (cancelled) return
        setAllowedUsers(entries)

        if (session?.vehicleId) {
          const bundle = await loadUserBundle(settings, session.vehicleId)
          if (cancelled) return
          setUserBundle(bundle)
        } else {
          setUserBundle(null)
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : '앱 초기화에 실패했습니다.'
          pushToast({
            tone: 'error',
            title: '초기화 실패',
            description: message,
          })
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [settings, session?.vehicleId])

  const saveSettings = (nextSettings: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...nextSettings }
      persistSettings(next)
      return next
    })
  }

  const updateSession = (nextSession: SessionState | null) => {
    setSession(nextSession)
    persistSession(nextSession)
  }

  const login = async (vehicleId: string, password: string) => {
    const user = allowedUsers.find((entry) => entry.vehicleId === vehicleId.trim())
    if (!user) {
      throw new Error('허용되지 않은 차량번호입니다.')
    }
    if (user.status !== 'activated') {
      throw new Error('아직 활성화되지 않은 차량번호입니다. 먼저 회원가입을 진행하세요.')
    }
    const isValid = await verifyPassword(
      user.vehicleId,
      password,
      user.passwordSalt,
      user.passwordHash,
    )
    if (!isValid) {
      throw new Error('비밀번호가 올바르지 않습니다.')
    }
    const bundle = await loadUserBundle(settings, user.vehicleId)
    setUserBundle(bundle)
    updateSession({
      vehicleId: user.vehicleId,
      loggedInAt: new Date().toISOString(),
    })
    pushToast({
      tone: 'success',
      title: '로그인 완료',
      description: `${user.vehicleId} 차량 데이터를 불러왔습니다.`,
    })
  }

  const activateAccount = async (vehicleId: string, password: string) => {
    if (!settings.token) {
      throw new Error('회원가입에는 GitHub token이 필요합니다.')
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      throw new Error(passwordError)
    }
    const target = allowedUsers.find((entry) => entry.vehicleId === vehicleId.trim())
    if (!target) {
      throw new Error('허용 목록에 없는 차량번호입니다.')
    }
    if (target.status === 'activated') {
      throw new Error('이미 활성화된 차량번호입니다.')
    }

    const salt = generateSalt()
    const passwordHash = await hashPassword(vehicleId, password, salt)
    const nextEntries = allowedUsers.map((entry) =>
      entry.vehicleId === vehicleId
        ? {
            ...entry,
            status: 'activated' as const,
            activatedAt: new Date().toISOString(),
            passwordUpdatedAt: new Date().toISOString(),
            passwordSalt: salt,
            passwordHash,
          }
        : entry,
    )

    const bundle = createEmptyUserBundle(vehicleId, settings.storageLimitBytes)
    await saveAllowedUsers(settings, nextEntries)
    await saveUserBundle(settings, bundle, `feat: initialize ${vehicleId}`)

    setAllowedUsers(nextEntries)
    setUserBundle(bundle)
    updateSession({
      vehicleId,
      loggedInAt: new Date().toISOString(),
    })
    pushToast({
      tone: 'success',
      title: '회원가입 완료',
      description: `${vehicleId} 계정이 활성화되었습니다.`,
    })
  }

  const withSaving = async (operation: () => Promise<void>) => {
    setIsSaving(true)
    try {
      await operation()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '요청 처리 중 오류가 발생했습니다.'
      pushToast({
        tone: 'error',
        title: '작업 실패',
        description: message,
      })
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  const commitBundle = async (nextBundle: UserBundle, messagePrefix: string) => {
    const recalculated = {
      ...nextBundle,
      storageSummary: calculateStorageUsageSummary(
        {
          profile: nextBundle.profile,
          odometerHistory: nextBundle.odometerHistory,
          maintenanceRecords: nextBundle.maintenanceRecords,
          scheduledMaintenance: nextBundle.scheduledMaintenance,
        },
        settings.storageLimitBytes,
      ),
    }

    if (recalculated.storageSummary.usedBytes > settings.storageLimitBytes) {
      throw new Error('저장공간 300MB를 초과하여 저장할 수 없습니다.')
    }

    await saveUserBundle(settings, recalculated, messagePrefix)
    setUserBundle(recalculated)
  }

  const updateOdometer = async (input: OdometerUpdateInput) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }
    await withSaving(async () => {
      if (
        input.odometerKm < userBundle.profile.currentOdometerKm &&
        !input.force
      ) {
        throw new Error(
          '현재 주행거리보다 작은 값입니다. 예외 상황이면 강제 저장 옵션을 사용하세요.',
        )
      }

      const entry: OdometerHistoryEntry = {
        id: createId('odo'),
        recordedAt: new Date().toISOString(),
        odometerKm: input.odometerKm,
        source: 'manual',
        note: input.note.trim(),
      }

      const nextBundle: UserBundle = {
        ...userBundle,
        profile: {
          ...userBundle.profile,
          currentOdometerKm: input.odometerKm,
          updatedAt: new Date().toISOString(),
        },
        odometerHistory: {
          ...userBundle.odometerHistory,
          currentOdometerKm: input.odometerKm,
          entries: [...userBundle.odometerHistory.entries, entry].sort(
            (left, right) =>
              parseISO(left.recordedAt).getTime() - parseISO(right.recordedAt).getTime(),
          ),
          updatedAt: new Date().toISOString(),
        },
      }

      await commitBundle(nextBundle, `feat: update odometer for ${userBundle.profile.vehicleId}`)
      pushToast({
        tone: 'success',
        title: '주행거리 저장',
        description: `${input.odometerKm.toLocaleString('ko-KR')}km로 갱신했습니다.`,
      })
    })
  }

  const uploadPendingAttachments = async (
    vehicleId: string,
    files: File[],
    kind: 'photos' | 'receipts',
  ) => {
    const attachments = []
    for (const file of files) {
      const validationMessage = validateAttachmentFile(file)
      if (validationMessage) {
        throw new Error(validationMessage)
      }
      const optimized = await optimizeImageFile(file)
      const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      attachments.push(
        await uploadAttachment(settings, vehicleId, optimized.blob, {
          fileName: file.name,
          originalFileName: file.name,
          kind,
          contentType,
          width: optimized.width,
          height: optimized.height,
        }),
      )
    }
    return attachments
  }

  const saveMaintenanceRecord = async (draft: MaintenanceRecordDraft) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }

    await withSaving(async () => {
      const totalCost = calculateTotalCost(draft.partsCost, draft.laborCost)
      const uploadedPhotos = await uploadPendingAttachments(
        userBundle.profile.vehicleId,
        draft.newPhotos,
        'photos',
      )
      const uploadedReceipts = await uploadPendingAttachments(
        userBundle.profile.vehicleId,
        draft.newReceipts,
        'receipts',
      )
      const existingRecord = draft.id
        ? userBundle.maintenanceRecords.records.find((record) => record.id === draft.id)
        : null

      if (
        draft.odometerKm < userBundle.profile.currentOdometerKm &&
        !draft.allowLowerOdometer
      ) {
        throw new Error(
          '현재 주행거리보다 작은 정비 주행거리입니다. 확인 후 다시 저장하세요.',
        )
      }

      const nextRecord: MaintenanceRecord = {
        id: draft.id ?? createId('record'),
        date: draft.date,
        odometerKm: draft.odometerKm,
        items: mapCodesToItems(draft.selectedItemCodes, draft.customItemsText),
        customItemsText: draft.customItemsText,
        shopName: draft.shopName.trim(),
        partsCost: draft.partsCost,
        laborCost: draft.laborCost,
        totalCost,
        notes: draft.notes.trim(),
        photos: [...draft.existingPhotos, ...uploadedPhotos],
        receiptPhotos: [...draft.existingReceipts, ...uploadedReceipts],
        representativePhotoId:
          draft.representativePhotoId ??
          draft.existingPhotos[0]?.id ??
          uploadedPhotos[0]?.id ??
          null,
        scheduledSourceId: draft.scheduledSourceId,
        createdAt: existingRecord?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const nextRecords = sortRecords(
        existingRecord
          ? userBundle.maintenanceRecords.records.map((record) =>
              record.id === nextRecord.id ? nextRecord : record,
            )
          : [nextRecord, ...userBundle.maintenanceRecords.records],
      )

      const shouldUpdateCurrentOdometer =
        draft.odometerKm >= userBundle.profile.currentOdometerKm

      const nextBundle: UserBundle = {
        ...userBundle,
        profile: {
          ...userBundle.profile,
          currentOdometerKm: shouldUpdateCurrentOdometer
            ? draft.odometerKm
            : userBundle.profile.currentOdometerKm,
          updatedAt: new Date().toISOString(),
        },
        maintenanceRecords: {
          ...userBundle.maintenanceRecords,
          records: nextRecords,
          updatedAt: new Date().toISOString(),
        },
        odometerHistory: shouldUpdateCurrentOdometer
          ? {
              ...userBundle.odometerHistory,
              currentOdometerKm: draft.odometerKm,
              entries: [
                ...userBundle.odometerHistory.entries,
                {
                  id: createId('odo'),
                  recordedAt: new Date().toISOString(),
                  odometerKm: draft.odometerKm,
                  source: 'maintenance' as const,
                  note: `${nextRecord.date} 정비 입력`,
                },
              ].sort(
                (left, right) =>
                  parseISO(left.recordedAt).getTime() -
                  parseISO(right.recordedAt).getTime(),
              ),
              updatedAt: new Date().toISOString(),
            }
          : userBundle.odometerHistory,
        scheduledMaintenance: draft.scheduledSourceId
          ? {
              ...userBundle.scheduledMaintenance,
              items: userBundle.scheduledMaintenance.items.map((item) =>
                item.id === draft.scheduledSourceId
                  ? {
                      ...item,
                      status: 'completed',
                      completedAt: new Date().toISOString(),
                      completedByRecordId: nextRecord.id,
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
              updatedAt: new Date().toISOString(),
            }
          : userBundle.scheduledMaintenance,
      }

      await commitBundle(
        nextBundle,
        `feat: save maintenance record for ${userBundle.profile.vehicleId}`,
      )
      pushToast({
        tone: 'success',
        title: draft.id ? '정비내역 수정' : '정비내역 저장',
        description: `${nextRecord.items[0]?.label ?? '정비'} 기록을 저장했습니다.`,
      })
    })
  }

  const deleteMaintenanceRecord = async (recordId: string) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }

    await withSaving(async () => {
      const record = userBundle.maintenanceRecords.records.find(
        (item) => item.id === recordId,
      )
      if (!record) {
        return
      }
      for (const attachment of [...record.photos, ...record.receiptPhotos]) {
        try {
          await deleteAttachment(settings, attachment.path)
        } catch {
          // Keep bundle update resilient even if the attachment cleanup fails.
        }
      }
      const nextBundle: UserBundle = {
        ...userBundle,
        maintenanceRecords: {
          ...userBundle.maintenanceRecords,
          records: userBundle.maintenanceRecords.records.filter(
            (item) => item.id !== recordId,
          ),
          updatedAt: new Date().toISOString(),
        },
      }
      await commitBundle(
        nextBundle,
        `feat: delete maintenance record for ${userBundle.profile.vehicleId}`,
      )
      pushToast({
        tone: 'success',
        title: '정비내역 삭제',
      })
    })
  }

  const saveScheduledMaintenance = async (draft: ScheduledMaintenanceDraft) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }

    await withSaving(async () => {
      const nextItem: ScheduledMaintenance = {
        id: draft.id ?? createId('schedule'),
        title: draft.title.trim(),
        items: mapCodesToItems(draft.selectedItemCodes, draft.title),
        scheduledDate: draft.scheduledDate || null,
        targetOdometerKm: draft.targetOdometerKm
          ? Number(draft.targetOdometerKm)
          : null,
        expectedCost: draft.expectedCost ? Number(draft.expectedCost) : null,
        priority: draft.priority,
        notes: draft.notes.trim(),
        status: 'pending',
        createdAt:
          userBundle.scheduledMaintenance.items.find((item) => item.id === draft.id)
            ?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        completedByRecordId: null,
      }

      const existing = userBundle.scheduledMaintenance.items.some(
        (item) => item.id === nextItem.id,
      )

      const nextBundle: UserBundle = {
        ...userBundle,
        scheduledMaintenance: {
          ...userBundle.scheduledMaintenance,
          items: existing
            ? userBundle.scheduledMaintenance.items.map((item) =>
                item.id === nextItem.id ? nextItem : item,
              )
            : [nextItem, ...userBundle.scheduledMaintenance.items],
          updatedAt: new Date().toISOString(),
        },
      }

      await commitBundle(
        nextBundle,
        `feat: save scheduled maintenance for ${userBundle.profile.vehicleId}`,
      )
      pushToast({
        tone: 'success',
        title: existing ? '정비예정 수정' : '정비예정 저장',
      })
    })
  }

  const deleteScheduledMaintenance = async (scheduleId: string) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }
    await withSaving(async () => {
      const nextBundle: UserBundle = {
        ...userBundle,
        scheduledMaintenance: {
          ...userBundle.scheduledMaintenance,
          items: userBundle.scheduledMaintenance.items.filter(
            (item) => item.id !== scheduleId,
          ),
          updatedAt: new Date().toISOString(),
        },
      }
      await commitBundle(
        nextBundle,
        `feat: delete scheduled maintenance for ${userBundle.profile.vehicleId}`,
      )
      pushToast({
        tone: 'success',
        title: '정비예정 삭제',
      })
    })
  }

  const markScheduleCompleted = async (scheduleId: string, recordId: string) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }
    await withSaving(async () => {
      const nextBundle: UserBundle = {
        ...userBundle,
        scheduledMaintenance: {
          ...userBundle.scheduledMaintenance,
          items: userBundle.scheduledMaintenance.items.map((item) =>
            item.id === scheduleId
              ? {
                  ...item,
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                  completedByRecordId: recordId,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
          updatedAt: new Date().toISOString(),
        },
      }
      await commitBundle(
        nextBundle,
        `feat: complete scheduled maintenance for ${userBundle.profile.vehicleId}`,
      )
    })
  }

  const importData = async (payload: ImportPayload) => {
    if (!userBundle || !session) {
      throw new Error('로그인이 필요합니다.')
    }
    await withSaving(async () => {
      if (payload.profile.vehicleId !== session.vehicleId) {
        throw new Error('다른 차량번호 데이터는 현재 계정에 가져올 수 없습니다.')
      }
      const nextBundle: UserBundle = {
        profile: payload.profile,
        odometerHistory: payload.odometerHistory,
        maintenanceRecords: payload.maintenanceRecords,
        scheduledMaintenance: payload.scheduledMaintenance,
        storageSummary:
          payload.storageSummary ??
          calculateStorageUsageSummary(
            {
              profile: payload.profile,
              odometerHistory: payload.odometerHistory,
              maintenanceRecords: payload.maintenanceRecords,
              scheduledMaintenance: payload.scheduledMaintenance,
            },
            settings.storageLimitBytes,
          ),
      }
      await commitBundle(nextBundle, `feat: import data for ${session.vehicleId}`)
      pushToast({
        tone: 'success',
        title: '데이터 가져오기 완료',
      })
    })
  }

  const exportData = () => {
    if (!userBundle) return null
    return {
      profile: userBundle.profile,
      odometerHistory: userBundle.odometerHistory,
      maintenanceRecords: userBundle.maintenanceRecords,
      scheduledMaintenance: userBundle.scheduledMaintenance,
      storageSummary: userBundle.storageSummary,
    }
  }

  const testGitHubConnection = async () => {
    try {
      await testRepositoryAccess(settings)
      pushToast({
        tone: 'success',
        title: 'GitHub 연결 성공',
        description: 'Repository contents API 접근이 확인되었습니다.',
      })
    } catch (error) {
      if (error instanceof GitHubApiError) {
        pushToast({
          tone: 'error',
          title: 'GitHub 연결 실패',
          description: error.message,
        })
        throw error
      }
      throw error
    }
  }

  const logout = () => {
    setUserBundle(null)
    updateSession(null)
  }

  const dashboardSummary = useMemo(
    () => (userBundle ? buildDashboardSummary(userBundle) : null),
    [userBundle],
  )

  const statistics = useMemo(
    () => (userBundle ? buildStatisticsSnapshot(userBundle) : null),
    [userBundle],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      session,
      allowedUsers,
      userBundle,
      dashboardSummary,
      statistics,
      isBootstrapping,
      isSaving,
      isReadOnly,
      toasts,
      saveSettings,
      refreshAllowedUsers,
      login,
      activateAccount,
      logout,
      pushToast,
      dismissToast,
      updateOdometer,
      saveMaintenanceRecord,
      deleteMaintenanceRecord,
      saveScheduledMaintenance,
      deleteScheduledMaintenance,
      markScheduleCompleted,
      importData,
      exportData,
      testGitHubConnection,
    }),
    [
      settings,
      session,
      allowedUsers,
      userBundle,
      dashboardSummary,
      statistics,
      isBootstrapping,
      isSaving,
      isReadOnly,
      toasts,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('AppContext가 초기화되지 않았습니다.')
  }
  return context
}
