import {
  CalendarClock,
  CircleAlert,
  Gauge,
  HardDrive,
  Plus,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  ProgressBar,
  SectionTitle,
} from '../components/ui'
import { ROUTES } from '../constants/app'
import { useApp } from '../context/AppContext'
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
  const [forceSave, setForceSave] = useState(false)
  const [odometerNote, setOdometerNote] = useState('')
  const [odometerError, setOdometerError] = useState<string | null>(null)

  if (!userBundle || !dashboardSummary) {
    return null
  }

  const scheduledItems = userBundle.scheduledMaintenance.items
    .filter((item) => item.status === 'pending')
    .slice(0, 4)
  const recentRecords = userBundle.maintenanceRecords.records.slice(0, 4)

  const storageTone =
    userBundle.storageSummary.percentUsed >= 95
      ? 'danger'
      : userBundle.storageSummary.percentUsed >= 75
        ? 'warn'
        : 'info'

  const handleOdometerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericValue = Number(odometerValue)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setOdometerError('주행거리를 확인하세요.')
      return
    }

    try {
      setOdometerError(null)
      await updateOdometer({
        odometerKm: numericValue,
        note: odometerNote,
        force: forceSave,
      })
      setForceSave(false)
      setOdometerNote('')
    } catch (error) {
      setOdometerError(
        error instanceof Error ? error.message : '주행거리 저장에 실패했습니다.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {userBundle.profile.vehicleId}
            </h1>
            <p className="mt-2 text-sm text-muted">현재 상태와 최근 기록만 간단히 보여줍니다.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate(ROUTES.records)}>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">현재 주행거리</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold">
                {formatKilometers(dashboardSummary.latestOdometerKm)}
              </p>
              <p className="mt-2 text-sm text-muted">{userBundle.profile.modelName}</p>
            </div>
            <Gauge className="h-8 w-8 text-accentSoft" />
          </div>
        </Card>

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
            <Wrench className="h-8 w-8 text-success" />
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
          <SectionTitle title="주행거리 갱신" />
          <form className="mt-5 grid gap-4" onSubmit={handleOdometerSubmit}>
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
                placeholder="예: 주유 후 확인"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                checked={forceSave}
                onChange={(event) => setForceSave(event.target.checked)}
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-panelAlt"
              />
              이전 기록보다 작아도 저장
            </label>
            {odometerError ? <p className="text-sm text-danger">{odometerError}</p> : null}
            <Button type="submit" className="w-full sm:w-fit">
              저장
            </Button>
          </form>
        </Card>

        <Card>
          <SectionTitle title="정비예정" />
          <div className="mt-5 space-y-3">
            {scheduledItems.length === 0 ? (
              <p className="text-sm text-muted">등록된 정비예정이 없습니다.</p>
            ) : (
              scheduledItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-panelAlt p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {formatShortDate(item.scheduledDate)} /{' '}
                        {item.targetOdometerKm
                          ? formatKilometers(item.targetOdometerKm)
                          : '-'}
                      </p>
                    </div>
                    <Badge
                      tone={
                        item.priority === 'high'
                          ? 'danger'
                          : item.priority === 'normal'
                            ? 'warn'
                            : 'info'
                      }
                    >
                      {item.priority === 'high'
                        ? '높음'
                        : item.priority === 'normal'
                          ? '보통'
                          : '낮음'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="최근 정비내역" />
        <div className="mt-5 space-y-4">
          {recentRecords.length === 0 ? (
            <p className="text-sm text-muted">아직 정비내역이 없습니다.</p>
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
                      {record.shopName || '업체명 미입력'} · {formatCurrency(record.totalCost)}
                    </p>
                    {record.notes ? (
                      <p className="mt-2 text-sm leading-6 text-muted">{record.notes}</p>
                    ) : null}
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
  )
}
