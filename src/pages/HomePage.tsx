import {
  CalendarClock,
  CircleAlert,
  HardDrive,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { useRef, useState } from 'react'
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
  const odometerSectionRef = useRef<HTMLDivElement | null>(null)
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
      <div className="rounded-[2rem] border border-accentSoft/20 bg-[radial-gradient(circle_at_top_right,rgba(201,233,255,0.18),transparent_34%),linear-gradient(135deg,#131a23_0%,#0d1118_100%)] px-5 py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {userBundle.profile.vehicleId}
            </h1>
            <p className="mt-4 text-sm text-muted">현재 주행거리</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-white">
              {formatKilometers(dashboardSummary.latestOdometerKm)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="min-w-[180px]"
              onClick={() =>
                odometerSectionRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
            >
              주행거리 갱신
            </Button>
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

      <div ref={odometerSectionRef}>
        <Card className="border-accentSoft/20 bg-[linear-gradient(180deg,rgba(201,233,255,0.08),rgba(201,233,255,0.02))]">
          <SectionTitle title="주행거리 갱신" />
          <form className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr_180px] lg:items-end" onSubmit={handleOdometerSubmit}>
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
            <Button type="submit" className="w-full lg:h-11">
              주행거리 갱신
            </Button>
          </form>
          <label className="mt-4 flex items-center gap-2 text-sm text-muted">
            <input
              checked={forceSave}
              onChange={(event) => setForceSave(event.target.checked)}
              type="checkbox"
              className="h-4 w-4 rounded border-border bg-panelAlt"
            />
            이전 기록보다 작아도 저장
          </label>
          {odometerError ? <p className="mt-3 text-sm text-danger">{odometerError}</p> : null}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
    </div>
  )
}
