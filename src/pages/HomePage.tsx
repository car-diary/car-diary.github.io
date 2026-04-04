import { addMonths, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import {
  CalendarClock,
  CircleAlert,
  HardDrive,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  ProgressBar,
  SectionTitle,
} from '../components/ui'
import { ROUTES } from '../constants/app'
import { useApp } from '../context/appContextStore'
import {
  formatBytes,
  formatCurrency,
  formatKilometers,
  formatPercent,
  formatShortDate,
} from '../lib/format'
import { getAttachmentUrl } from '../services/carDiaryRepository'

export const HomePage = () => {
  const navigate = useNavigate()
  const { userBundle, dashboardSummary, settings, updateOdometer } = useApp()
  const [odometerValue, setOdometerValue] = useState(
    String(userBundle?.profile.currentOdometerKm ?? 0),
  )
  const [odometerNote, setOdometerNote] = useState('')
  const [odometerError, setOdometerError] = useState<string | null>(null)
  const [isOdometerModalOpen, setIsOdometerModalOpen] = useState(false)
  const [isUpdatingOdometer, setIsUpdatingOdometer] = useState(false)

  if (!userBundle || !dashboardSummary) {
    return null
  }

  const now = startOfDay(new Date())
  const currentOdometerKm = userBundle.profile.currentOdometerKm
  const upcomingSchedules = userBundle.scheduledMaintenance.items
    .filter((item) => item.status === 'pending')
    .map((item) => {
      const scheduledDayDiff = item.scheduledDate
        ? differenceInCalendarDays(parseISO(item.scheduledDate), now)
        : null
      const targetKmDiff =
        item.targetOdometerKm === null ? null : item.targetOdometerKm - currentOdometerKm

      return {
        ...item,
        scheduledDayDiff,
        targetKmDiff,
      }
    })
    .filter((item) => {
      const withinSixMonths =
        item.scheduledDate !== null &&
        parseISO(item.scheduledDate) <= addMonths(now, 6)
      const withinTenThousandKm =
        item.targetKmDiff !== null && item.targetKmDiff <= 10000

      return withinSixMonths || withinTenThousandKm
    })
    .sort((left, right) => {
      const leftDateRank = left.scheduledDayDiff ?? Number.POSITIVE_INFINITY
      const rightDateRank = right.scheduledDayDiff ?? Number.POSITIVE_INFINITY
      if (leftDateRank !== rightDateRank) {
        return leftDateRank - rightDateRank
      }

      const leftKmRank = left.targetKmDiff ?? Number.POSITIVE_INFINITY
      const rightKmRank = right.targetKmDiff ?? Number.POSITIVE_INFINITY
      if (leftKmRank !== rightKmRank) {
        return leftKmRank - rightKmRank
      }

      return left.title.localeCompare(right.title, 'ko')
    })
    .slice(0, 4)
  const recentRecords = userBundle.maintenanceRecords.records.slice(0, 4)

  const storageTone =
    userBundle.storageSummary.percentUsed >= 95
      ? 'danger'
      : userBundle.storageSummary.percentUsed >= 75
        ? 'warn'
        : 'info'

  const openOdometerModal = () => {
    setOdometerValue(String(userBundle.profile.currentOdometerKm))
    setOdometerNote('')
    setOdometerError(null)
    setIsOdometerModalOpen(true)
  }

  const handleOdometerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!odometerValue.trim()) {
      setOdometerError('주행거리를 입력해 주세요.')
      return
    }
    const numericValue = Number(odometerValue)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setOdometerError('주행거리를 확인하세요.')
      return
    }

    try {
      setOdometerError(null)
      setIsUpdatingOdometer(true)
      await updateOdometer({
        odometerKm: numericValue,
        note: odometerNote,
      })
      setOdometerNote('')
      setIsOdometerModalOpen(false)
    } catch (error) {
      setOdometerError(
        error instanceof Error ? error.message : '주행거리 저장에 실패했습니다.',
      )
    } finally {
      setIsUpdatingOdometer(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-hero rounded-[2rem] border border-accentSoft/20 px-5 py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {userBundle.profile.vehicleId}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-5xl font-semibold tracking-tight text-text">
                {formatKilometers(dashboardSummary.latestOdometerKm)}
              </p>
              <Button variant="secondary" size="sm" onClick={openOdometerModal}>
                주행거리 갱신
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => navigate(ROUTES.records)}>
              <Plus className="h-4 w-4" />
              정비내역 추가
            </Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.scheduled)}>
              <CalendarClock className="h-4 w-4" />
              정비예정 추가
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">이번 달 지출</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold">
                {formatCurrency(dashboardSummary.monthlySpend)}
              </p>
              <p className="mt-2 text-sm text-muted">
                연간 누적 {formatCurrency(dashboardSummary.yearlySpend)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-success" />
          </div>
        </Card>

        <Card>
          <p className="text-sm text-muted">정비예정</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold">{dashboardSummary.pendingSchedules}건</p>
              <p className="mt-2 text-sm text-muted">
                경고 {dashboardSummary.urgentAlerts.length}건
              </p>
            </div>
            <CalendarClock className="h-8 w-8 text-warn" />
          </div>
        </Card>

        <Card>
          <p className="text-sm text-muted">저장공간</p>
          <div className="mt-4">
            <div className="flex items-end justify-between gap-3">
              <p className="text-3xl font-semibold">
                {formatPercent(userBundle.storageSummary.percentUsed)}
              </p>
              <HardDrive className="h-8 w-8 text-accentSoft" />
            </div>
            <p className="mt-2 text-sm text-muted">
              {formatBytes(userBundle.storageSummary.usedBytes)} /{' '}
              {formatBytes(userBundle.storageSummary.limitBytes)}
            </p>
            <div className="mt-4">
              <ProgressBar
                value={userBundle.storageSummary.percentUsed}
                tone={storageTone}
              />
            </div>
          </div>
        </Card>
      </div>

      {dashboardSummary.urgentAlerts.length > 0 ? (
        <Card className="border-danger/30 bg-danger/10">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 text-danger" />
            <div className="space-y-2">
              <p className="font-semibold text-text">경고</p>
              {dashboardSummary.urgentAlerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-danger/20 bg-slate-950/20 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        alert.tone === 'danger'
                          ? 'danger'
                          : alert.tone === 'warn'
                            ? 'warn'
                            : 'info'
                      }
                    >
                      {alert.title}
                    </Badge>
                    <span className="text-sm text-text">{alert.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <SectionTitle title="다가오는 정비 일정" />
          <div className="mt-5 space-y-3">
            {upcomingSchedules.length === 0 ? (
              <p className="text-sm text-muted">-</p>
            ) : (
              upcomingSchedules.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-panelAlt p-4">
                  <div className="space-y-2">
                    <p className="font-semibold">{item.title}</p>
                    {item.scheduledDate ? (
                      <p className="text-sm text-muted">
                        예정일 {formatShortDate(item.scheduledDate)} ·{' '}
                        {item.scheduledDayDiff !== null && item.scheduledDayDiff < 0
                          ? `${Math.abs(item.scheduledDayDiff)}일 경과`
                          : `D-${item.scheduledDayDiff ?? 0}`}
                      </p>
                    ) : null}
                    {item.targetOdometerKm !== null ? (
                      <p className="text-sm text-muted">
                        목표 {formatKilometers(item.targetOdometerKm)} ·{' '}
                        {item.targetKmDiff !== null && item.targetKmDiff < 0
                          ? `${formatKilometers(Math.abs(item.targetKmDiff))} 초과`
                          : `${formatKilometers(item.targetKmDiff ?? 0)} 남음`}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="최근 정비내역" />
          <div className="mt-5 space-y-4">
            {recentRecords.length === 0 ? (
              <p className="text-sm text-muted">-</p>
            ) : (
              recentRecords.map((record) => (
                <div key={record.id} className="rounded-3xl border border-border bg-panelAlt p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {record.items.map((item) => (
                          <Badge key={`${record.id}-${item.code}`} tone="info">
                            {item.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-3 font-semibold">
                        {formatShortDate(record.date)} · {formatKilometers(record.odometerKm)}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {record.shopName || '-'} · {formatCurrency(record.totalCost)}
                      </p>
                    </div>
                    <div className="text-sm text-muted">
                      사진 {record.photos.length}장 · 영수증 {record.receiptPhotos.length}장
                    </div>
                  </div>

                  {record.photos.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {record.photos.slice(0, 3).map((photo) => (
                        <div
                          key={photo.id}
                          className="overflow-hidden rounded-2xl border border-border bg-panel"
                        >
                          <img
                            src={getAttachmentUrl(settings, photo.path)}
                            alt={photo.originalFileName}
                            className="aspect-[4/3] w-full object-cover"
                          />
                          <div className="px-3 py-2">
                            <p className="truncate text-sm text-text">{photo.originalFileName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={isOdometerModalOpen}
        title="주행거리 갱신"
        onClose={() => setIsOdometerModalOpen(false)}
      >
        <form className="space-y-4" onSubmit={handleOdometerSubmit}>
          <Field label="현재 주행거리 (km)">
            <Input
              type="number"
              value={odometerValue}
              onChange={(event) => setOdometerValue(event.target.value)}
            />
          </Field>
          <Field label="메모">
            <Input
              value={odometerNote}
              onChange={(event) => setOdometerNote(event.target.value)}
            />
          </Field>
          {odometerError ? <p className="text-sm text-danger">{odometerError}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              className="flex-1"
              loading={isUpdatingOdometer}
              loadingLabel="갱신 중"
            >
              저장
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={isUpdatingOdometer}
              onClick={() => setIsOdometerModalOpen(false)}
            >
              취소
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
