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
import { buildDashboardSummary, buildStatisticsSnapshot } from '../lib/selectors'
import { calculateStorageUsageSummary } from '../lib/storage'
import { createId, safeJsonParse } from '../lib/utils'
import { calculateTotalCost, validateAttachmentFile } from '../lib/validation'
import {
  createEmptyUserBundle,
  deleteAttachment,
  loadUserBundle,
  readAllowedUsers,
  saveUserBundle,
  uploadAttachment,
} from '../services/carDiaryRepository'
import { GitHubApiError, testRepositoryAccess } from '../services/githubApi'
import type {
  AllowedUserPublicEntry,
  AppSettings,
  AttachmentPhoto,
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

const AppContext = createContext<AppContextValue | null>(null)

const persistSettings = (settings: AppSettings) => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.appSettings, JSON.stringify(settings))
}

const persistSession = (session: SessionState | null) => {
  if (!session) {
    sessionStorage.removeItem(LOCAL_STORAGE_KEYS.session)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.session)
    return
  }
  sessionStorage.setItem(LOCAL_STORAGE_KEYS.session, JSON.stringify(session))
  localStorage.removeItem(LOCAL_STORAGE_KEYS.session)
}

const readLocalSettings = (): AppSettings => {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.appSettings)
  if (!raw) return DEFAULT_APP_SETTINGS

  const parsed = safeJsonParse<Partial<AppSettings>>(raw, {})
  return {
    ...DEFAULT_APP_SETTINGS,
    ...parsed,
    token: parsed.token?.trim() ? parsed.token : DEFAULT_APP_SETTINGS.token,
    theme: parsed.theme === 'light' ? 'light' : 'dark',
  }
}

const readLocalSession = (): SessionState | null => {
  const raw = sessionStorage.getItem(LOCAL_STORAGE_KEYS.session)
  localStorage.removeItem(LOCAL_STORAGE_KEYS.session)
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

const sortOdometerEntries = (entries: OdometerHistoryEntry[]) =>
  [...entries].sort(
    (left, right) =>
      parseISO(left.recordedAt).getTime() - parseISO(right.recordedAt).getTime(),
  )

const deriveCurrentOdometerKm = (
  entries: OdometerHistoryEntry[],
  records: MaintenanceRecord[],
) => {
  const entryMax = entries.reduce(
    (highest, entry) => Math.max(highest, entry.odometerKm),
    0,
  )
  const recordMax = records.reduce(
    (highest, record) => Math.max(highest, record.odometerKm),
    0,
  )
  return Math.max(entryMax, recordMax)
}

const matchesMaintenanceEntry = (
  entry: OdometerHistoryEntry,
  record: Pick<MaintenanceRecord, 'id' | 'date' | 'odometerKm'>,
) =>
  entry.relatedRecordId === record.id ||
  (entry.source === 'maintenance' &&
    entry.note === `${record.date} 정비 입력` &&
    entry.odometerKm === record.odometerKm)

const tagAttachmentsToItems = (
  attachments: AttachmentPhoto[],
  relatedItemCodes: string[],
) =>
  attachments.map((attachment) => ({
    ...attachment,
    relatedItemCodes,
  }))

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

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

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
            error instanceof Error ? error.message : '초기 데이터 로딩에 실패했습니다.'
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
  }, [
    settings.allowedUsersPath,
    settings.branch,
    settings.dataRootPath,
    settings.preferLocalPublicFiles,
    settings.repoName,
    settings.repoOwner,
    settings.token,
    session?.vehicleId,
  ])

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

  const login = async (vehicleId: string) => {
    const user = allowedUsers.find((entry) => entry.vehicleId === vehicleId.trim())
    if (!user) {
      throw new Error('허용되지 않은 차량번호입니다.')
    }

    try {
      const bundle = await loadUserBundle(settings, user.vehicleId)
      setUserBundle(bundle)
    } catch (error) {
      if (error instanceof GitHubApiError && error.code === 'not_found') {
        if (!settings.token) {
          throw new Error('초기 차량 데이터를 생성할 권한이 없습니다.')
        }
        const initialBundle = createEmptyUserBundle(
          user.vehicleId,
          settings.storageLimitBytes,
        )
        await saveUserBundle(settings, initialBundle, `feat: initialize ${user.vehicleId}`)
        setUserBundle(initialBundle)
      } else {
        throw error
      }
    }

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

  const cleanupAttachments = async (attachments: AttachmentPhoto[]) => {
    if (attachments.length === 0) return 0

    const results = await Promise.allSettled(
      attachments.map((attachment) => deleteAttachment(settings, attachment.path)),
    )

    return results.filter((result) => result.status === 'rejected').length
  }

  const uploadPendingAttachments = async (
    vehicleId: string,
    files: File[],
    kind: 'photos' | 'receipts',
    relatedItemCodes: string[],
  ) => {
    files.forEach((file) => {
      const validationMessage = validateAttachmentFile(file)
      if (validationMessage) {
        throw new Error(validationMessage)
      }
    })

    const attachments: AttachmentPhoto[] = []
    for (const file of files) {
      const optimized = await optimizeImageFile(file)
      const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const uploaded = await uploadAttachment(settings, vehicleId, optimized.blob, {
        fileName: file.name,
        originalFileName: file.name,
        kind,
        contentType,
        width: optimized.width,
        height: optimized.height,
      })
      attachments.push({
        ...uploaded,
        relatedItemCodes,
      })
    }
    return attachments
  }

  const updateOdometer = async (input: OdometerUpdateInput) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }

    await withSaving(async () => {
      const entry: OdometerHistoryEntry = {
        id: createId('odo'),
        recordedAt: new Date().toISOString(),
        odometerKm: input.odometerKm,
        source: 'manual',
        note: input.note.trim(),
        relatedRecordId: null,
      }

      const nextEntries = sortOdometerEntries([...userBundle.odometerHistory.entries, entry])
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
          entries: nextEntries,
          updatedAt: new Date().toISOString(),
        },
      }

      await commitBundle(nextBundle, `feat: update odometer for ${userBundle.profile.vehicleId}`)
      pushToast({
        tone: 'success',
        title: '주행거리 저장',
        description: `${input.odometerKm.toLocaleString('ko-KR')}km로 업데이트했습니다.`,
      })
    })
  }

  const saveMaintenanceRecord = async (draft: MaintenanceRecordDraft) => {
    if (!userBundle) {
      throw new Error('로그인이 필요합니다.')
    }

    await withSaving(async () => {
      if (draft.selectedItemCodes.length === 0) {
        throw new Error('정비항목을 하나 이상 선택하세요.')
      }

      const totalCost =
        Number.isFinite(draft.totalCost) && draft.totalCost >= 0
          ? draft.totalCost
          : calculateTotalCost(draft.partsCost, draft.laborCost)
      const existingRecord = draft.id
        ? userBundle.maintenanceRecords.records.find((record) => record.id === draft.id)
        : null
      const nextRecordId = draft.id ?? createId('record')
      const relatedItemCodes = [...draft.selectedItemCodes]

      let uploadedPhotos: AttachmentPhoto[] = []
      let uploadedReceipts: AttachmentPhoto[] = []

      try {
        uploadedPhotos = await uploadPendingAttachments(
          userBundle.profile.vehicleId,
          draft.newPhotos,
          'photos',
          relatedItemCodes,
        )
        uploadedReceipts = await uploadPendingAttachments(
          userBundle.profile.vehicleId,
          draft.newReceipts,
          'receipts',
          relatedItemCodes,
        )

        const photos = tagAttachmentsToItems(
          [...draft.existingPhotos, ...uploadedPhotos],
          relatedItemCodes,
        )
        const receiptPhotos = tagAttachmentsToItems(
          [...draft.existingReceipts, ...uploadedReceipts],
          relatedItemCodes,
        )

        const nextRecord: MaintenanceRecord = {
          id: nextRecordId,
          date: draft.date,
          odometerKm: draft.odometerKm,
          items: mapCodesToItems(draft.selectedItemCodes, draft.customItemsText),
          customItemsText: draft.customItemsText,
          shopName: draft.shopName.trim(),
          partsCost: draft.partsCost,
          laborCost: draft.laborCost,
          totalCost,
          notes: draft.notes.trim(),
          photos,
          receiptPhotos,
          representativePhotoId:
            draft.representativePhotoId ?? photos[0]?.id ?? null,
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

        const nextOdometerEntries = sortOdometerEntries([
          ...userBundle.odometerHistory.entries.filter(
            (entry) => !existingRecord || !matchesMaintenanceEntry(entry, existingRecord),
          ),
          {
            id: createId('odo'),
            recordedAt: new Date().toISOString(),
            odometerKm: draft.odometerKm,
            source: 'maintenance',
            note: `${nextRecord.date} 정비 입력`,
            relatedRecordId: nextRecord.id,
          },
        ])

        const nextCurrentOdometerKm = deriveCurrentOdometerKm(
          nextOdometerEntries,
          nextRecords,
        )

        const nextScheduledItems = userBundle.scheduledMaintenance.items.map((item) => {
          if (draft.scheduledSourceId && item.id === draft.scheduledSourceId) {
            return {
              ...item,
              status: 'completed' as const,
              completedAt: new Date().toISOString(),
              completedByRecordId: nextRecord.id,
              updatedAt: new Date().toISOString(),
            }
          }

          if (
            existingRecord?.scheduledSourceId &&
            item.id === existingRecord.scheduledSourceId &&
            existingRecord.scheduledSourceId !== draft.scheduledSourceId &&
            item.completedByRecordId === nextRecord.id
          ) {
            return {
              ...item,
              status: 'pending' as const,
              completedAt: null,
              completedByRecordId: null,
              updatedAt: new Date().toISOString(),
            }
          }

          return item
        })

        const nextBundle: UserBundle = {
          ...userBundle,
          profile: {
            ...userBundle.profile,
            currentOdometerKm: nextCurrentOdometerKm,
            updatedAt: new Date().toISOString(),
          },
          maintenanceRecords: {
            ...userBundle.maintenanceRecords,
            records: nextRecords,
            updatedAt: new Date().toISOString(),
          },
          odometerHistory: {
            ...userBundle.odometerHistory,
            currentOdometerKm: nextCurrentOdometerKm,
            entries: nextOdometerEntries,
            updatedAt: new Date().toISOString(),
          },
          scheduledMaintenance: {
            ...userBundle.scheduledMaintenance,
            items: nextScheduledItems,
            updatedAt: new Date().toISOString(),
          },
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
      } catch (error) {
        const cleanupFailures = await cleanupAttachments([
          ...uploadedPhotos,
          ...uploadedReceipts,
        ])

        if (cleanupFailures > 0) {
          pushToast({
            tone: 'info',
            title: '첨부파일 확인 필요',
            description: '저장에 실패했고 일부 첨부파일이 저장소에 남아 있을 수 있습니다.',
          })
        }

        throw error
      }
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

      const nextRecords = userBundle.maintenanceRecords.records.filter(
        (item) => item.id !== recordId,
      )
      const nextOdometerEntries = sortOdometerEntries(
        userBundle.odometerHistory.entries.filter(
          (entry) => !matchesMaintenanceEntry(entry, record),
        ),
      )
      const nextCurrentOdometerKm = deriveCurrentOdometerKm(
        nextOdometerEntries,
        nextRecords,
      )

      const nextBundle: UserBundle = {
        ...userBundle,
        profile: {
          ...userBundle.profile,
          currentOdometerKm: nextCurrentOdometerKm,
          updatedAt: new Date().toISOString(),
        },
        maintenanceRecords: {
          ...userBundle.maintenanceRecords,
          records: nextRecords,
          updatedAt: new Date().toISOString(),
        },
        odometerHistory: {
          ...userBundle.odometerHistory,
          currentOdometerKm: nextCurrentOdometerKm,
          entries: nextOdometerEntries,
          updatedAt: new Date().toISOString(),
        },
        scheduledMaintenance: {
          ...userBundle.scheduledMaintenance,
          items: userBundle.scheduledMaintenance.items.map((item) =>
            item.completedByRecordId === recordId
              ? {
                  ...item,
                  status: 'pending',
                  completedAt: null,
                  completedByRecordId: null,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
          updatedAt: new Date().toISOString(),
        },
      }

      await commitBundle(
        nextBundle,
        `feat: delete maintenance record for ${userBundle.profile.vehicleId}`,
      )

      const cleanupFailures = await cleanupAttachments([
        ...record.photos,
        ...record.receiptPhotos,
      ])

      if (cleanupFailures > 0) {
        pushToast({
          tone: 'info',
          title: '일부 첨부파일은 수동 확인 필요',
          description: '정비내역은 삭제했지만 일부 이미지 파일은 저장소에 남아 있을 수 있습니다.',
        })
      }

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
      const existingSchedule = userBundle.scheduledMaintenance.items.find(
        (item) => item.id === draft.id,
      )

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
        status: existingSchedule?.status ?? 'pending',
        createdAt: existingSchedule?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: existingSchedule?.completedAt ?? null,
        completedByRecordId: existingSchedule?.completedByRecordId ?? null,
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
      pushToast({
        tone: 'success',
        title: '정비예정 완료 처리',
      })
    })
  }

  const importData = async (payload: ImportPayload) => {
    if (!userBundle || !session) {
      throw new Error('로그인이 필요합니다.')
    }

    await withSaving(async () => {
      if (payload.profile.vehicleId !== session.vehicleId) {
        throw new Error('다른 차량번호 데이터는 현재 계정으로 가져올 수 없습니다.')
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
        title: '저장소 연결 확인 완료',
        description: 'GitHub 저장 연결 상태를 확인했습니다.',
      })
    } catch (error) {
      if (error instanceof GitHubApiError) {
        pushToast({
          tone: 'error',
          title: '저장소 연결 실패',
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
