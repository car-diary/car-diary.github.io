import { CalendarCheck2, CalendarClock, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LOCAL_STORAGE_KEYS, ROUTES } from '../constants/app'
import { MAINTENANCE_CATEGORIES } from '../constants/maintenanceItems'
import { useApp } from '../context/AppContext'
import { persistMaintenanceRecordDraft } from '../features/maintenanceRecords'
import {
  readVehicleScopedDraft,
  writeVehicleScopedDraft,
} from '../lib/draftStorage'
import { formatCurrency, formatKilometers, formatShortDate } from '../lib/format'
import type { ScheduledMaintenance, ScheduledMaintenanceDraft } from '../types/models'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  TextArea,
} from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

const createEmptyDraft = (vehicleId: string): ScheduledMaintenanceDraft => ({
  vehicleId,
  title: '',
  selectedItemCodes: [],
  scheduledDate: '',
  targetOdometerKm: '',
  expectedCost: '',
  priority: 'normal',
  notes: '',
})

const buildDraftFromSchedule = (
  vehicleId: string,
  schedule: ScheduledMaintenance,
): ScheduledMaintenanceDraft => ({
  id: schedule.id,
  vehicleId,
  title: schedule.title,
  selectedItemCodes: schedule.items.map((item) => item.code),
  scheduledDate: schedule.scheduledDate ?? '',
  targetOdometerKm: schedule.targetOdometerKm
    ? String(schedule.targetOdometerKm)
    : '',
  expectedCost: schedule.expectedCost ? String(schedule.expectedCost) : '',
  priority: schedule.priority,
  notes: schedule.notes,
})

export const ScheduledMaintenancePage = () => {
  const navigate = useNavigate()
  const {
    userBundle,
    saveScheduledMaintenance,
    deleteScheduledMaintenance,
    markScheduleCompleted,
    isReadOnly,
  } = useApp()
  const vehicleId = userBundle?.profile.vehicleId ?? ''
  const [draft, setDraft] = useState<ScheduledMaintenanceDraft>(createEmptyDraft(''))
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>(
    'pending',
  )
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!vehicleId) return

    setDraft({
      ...createEmptyDraft(vehicleId),
      ...readVehicleScopedDraft<ScheduledMaintenanceDraft>(
        LOCAL_STORAGE_KEYS.scheduleDraft,
        vehicleId,
      ),
      vehicleId,
    })
  }, [vehicleId])

  useEffect(() => {
    if (!draft.vehicleId) return
    writeVehicleScopedDraft(LOCAL_STORAGE_KEYS.scheduleDraft, draft.vehicleId, draft)
  }, [draft])

  const schedules = userBundle?.scheduledMaintenance.items ?? []
  const currentOdometerKm = userBundle?.profile.currentOdometerKm ?? 0

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) =>
        statusFilter === 'all' ? true : schedule.status === statusFilter,
      ),
    [schedules, statusFilter],
  )

  if (!userBundle) {
    return null
  }

  const resetDraft = () => {
    const next = createEmptyDraft(userBundle.profile.vehicleId)
    setDraft(next)
    setFormError(null)
    writeVehicleScopedDraft(LOCAL_STORAGE_KEYS.scheduleDraft, next.vehicleId, next)
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.title.trim() && draft.selectedItemCodes.length === 0) {
      setFormError('정비명 또는 정비항목을 입력하세요.')
      return
    }
    if (!draft.scheduledDate && !draft.targetOdometerKm) {
      setFormError('예정일 또는 목표주행거리 중 하나는 입력해야 합니다.')
      return
    }
    try {
      await saveScheduledMaintenance(draft)
      resetDraft()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  const buildScheduleTone = (schedule: ScheduledMaintenance) => {
    if (
      schedule.targetOdometerKm !== null &&
      currentOdometerKm >= schedule.targetOdometerKm
    ) {
      return 'danger'
    }
    if (
      schedule.targetOdometerKm !== null &&
      schedule.targetOdometerKm - currentOdometerKm <= 500
    ) {
      return 'warn'
    }
    if (
      schedule.scheduledDate &&
      schedule.scheduledDate < new Date().toISOString().slice(0, 10)
    ) {
      return 'danger'
    }
    return 'info'
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
          Schedule
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">정비예정</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <SectionTitle
            title={draft.id ? '정비예정 수정' : '정비예정 추가'}
            action={
              <Button variant="ghost" onClick={resetDraft}>
                <RotateCcw className="h-4 w-4" />
                새로 작성
              </Button>
            }
          />
          <form className="mt-5 space-y-5" onSubmit={handleSave}>
            <Field label="정비명">
              <Input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="예: 엔진오일 + 필터 교환"
              />
            </Field>

            <div className="rounded-3xl border border-border bg-panelAlt p-4">
              <p className="text-sm font-semibold text-text">정비항목 선택</p>
              <div className="mt-4 space-y-4">
                {MAINTENANCE_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <p className="text-sm font-medium text-accentSoft">{category.label}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {category.items.map((item) => {
                        const checked = draft.selectedItemCodes.includes(item.code)
                        return (
                          <button
                            type="button"
                            key={item.code}
                            className={`rounded-full border px-3 py-2 text-sm transition ${
                              checked
                                ? 'border-accent bg-accent text-slate-950'
                                : 'border-border bg-panel text-muted hover:text-text'
                            }`}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                selectedItemCodes: checked
                                  ? current.selectedItemCodes.filter(
                                      (code) => code !== item.code,
                                    )
                                  : [...current.selectedItemCodes, item.code],
                              }))
                            }
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="정비예정일">
                <Input
                  type="date"
                  value={draft.scheduledDate}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, scheduledDate: event.target.value }))
                  }
                />
              </Field>
              <Field label="목표주행거리">
                <Input
                  type="number"
                  value={draft.targetOdometerKm}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetOdometerKm: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="예상비용">
                <Input
                  type="number"
                  value={draft.expectedCost}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, expectedCost: event.target.value }))
                  }
                />
              </Field>
              <Field label="중요도">
                <select
                  className="h-11 rounded-2xl border border-border bg-panelAlt px-4 text-sm"
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      priority: event.target.value as ScheduledMaintenanceDraft['priority'],
                    }))
                  }
                >
                  <option value="low">낮음</option>
                  <option value="normal">보통</option>
                  <option value="high">높음</option>
                </select>
              </Field>
            </div>

            <Field label="메모">
              <TextArea
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="교환 주기, 우선순위 사유, 부품 후보 등을 적어둘 수 있습니다."
              />
            </Field>

            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="flex-1" disabled={isReadOnly}>
                <CalendarClock className="h-4 w-4" />
                {draft.id ? '정비예정 수정' : '정비예정 저장'}
              </Button>
              <Button type="button" variant="secondary" onClick={resetDraft} className="flex-1">
                폼 초기화
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle
            title="정비예정 목록"
            action={
              <select
                className="h-11 rounded-2xl border border-border bg-panelAlt px-4 text-sm"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'pending' | 'completed' | 'all')
                }
              >
                <option value="pending">대기 중</option>
                <option value="completed">완료됨</option>
                <option value="all">전체</option>
              </select>
            }
          />
          <div className="mt-5 space-y-3">
            {filteredSchedules.length === 0 ? (
              <EmptyState
                title="등록된 정비예정이 없습니다."
                description="정비예정을 추가하세요."
              />
            ) : (
              filteredSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-3xl border border-border bg-panelAlt p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={buildScheduleTone(schedule)}>
                          {schedule.status === 'completed' ? '완료' : '대기'}
                        </Badge>
                        <Badge
                          tone={
                            schedule.priority === 'high'
                              ? 'danger'
                              : schedule.priority === 'normal'
                                ? 'warn'
                                : 'info'
                          }
                        >
                          {schedule.priority}
                        </Badge>
                      </div>
                      <p className="mt-3 font-semibold text-text">{schedule.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        예정일 {formatShortDate(schedule.scheduledDate)} / 목표주행거리{' '}
                        {schedule.targetOdometerKm
                          ? formatKilometers(schedule.targetOdometerKm)
                          : '-'}{' '}
                        / 예상비용{' '}
                        {schedule.expectedCost ? formatCurrency(schedule.expectedCost) : '-'}
                      </p>
                      {schedule.notes ? (
                        <p className="mt-2 text-sm leading-6 text-muted">{schedule.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setDraft(buildDraftFromSchedule(userBundle.profile.vehicleId, schedule))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        수정
                      </Button>
                      {schedule.status === 'pending' ? (
                        <>
                          <Button
                            onClick={() => {
                              const draftRecord = {
                                vehicleId: userBundle.profile.vehicleId,
                                date: today(),
                                odometerKm: currentOdometerKm,
                                selectedItemCodes: schedule.items.map((item) => item.code),
                                customItemsText: '',
                                shopName: '',
                                partsCost: schedule.expectedCost ?? 0,
                                laborCost: 0,
                                totalCost: schedule.expectedCost ?? 0,
                                notes: schedule.notes,
                                representativePhotoId: null,
                                existingPhotos: [],
                                existingReceipts: [],
                                newPhotos: [],
                                newReceipts: [],
                                scheduledSourceId: schedule.id,
                              }
                              persistMaintenanceRecordDraft(draftRecord)
                              navigate(ROUTES.records)
                            }}
                            disabled={isReadOnly}
                          >
                            <CalendarCheck2 className="h-4 w-4" />
                            정비내역으로 전환
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => markScheduleCompleted(schedule.id, 'manual-complete')}
                            disabled={isReadOnly}
                          >
                            완료만 표시
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="danger"
                        onClick={() => setDeleteTargetId(schedule.id)}
                        disabled={isReadOnly}
                      >
                        <Trash2 className="h-4 w-4" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(deleteTargetId)}
        title="정비예정 삭제"
        description="삭제 전 마지막으로 확인하세요."
        onClose={() => setDeleteTargetId(null)}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (!deleteTargetId) return
              await deleteScheduledMaintenance(deleteTargetId)
              setDeleteTargetId(null)
            }}
          >
            삭제 확인
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTargetId(null)}>
            취소
          </Button>
        </div>
      </Modal>
    </div>
  )
}
