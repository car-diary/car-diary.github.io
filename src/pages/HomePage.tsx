import {
  ArrowRight,
  Camera,
  CalendarClock,
  CircleAlert,
  Gauge,
  HardDrive,
  Plus,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHero,
  ProgressBar,
  SectionTitle,
} from '../components/ui'

export const HomePage = () => {
  const navigate = useNavigate()
  const { userBundle, dashboardSummary, settings, updateOdometer } = useApp()
  const [odometerValue, setOdometerValue] = useState(
    String(userBundle?.profile.currentOdometerKm ?? 0),
  )
  const [forceSave, setForceSave] = useState(false)
  const [odometerNote, setOdometerNote] = useState('')
  const [odometerError, setOdometerError] = useState<string | null>(null)

  const recentRecords = userBundle?.maintenanceRecords.records.slice(0, 3) ?? []
  const scheduledItems = userBundle?.scheduledMaintenance.items
    .filter((item) => item.status === 'pending')
    .slice(0, 4)

  const recentPhotos = useMemo(
    () =>
      (userBundle?.maintenanceRecords.records ?? [])
        .flatMap((record) => record.photos)
        .slice(0, 6),
    [userBundle],
  )

  if (!userBundle || !dashboardSummary) {
    return null
  }

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
      setOdometerError('유효한 주행거리를 입력하세요.')
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
      <PageHero
        title={`${userBundle.profile.vehicleId} 차량 상태 요약`}
        description="주행거리, 정비예정, 비용 흐름, 저장공간 사용량까지 한 번에 확인할 수 있도록 홈 화면을 구성했습니다."
        aside={
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate(ROUTES.records)}>
              <Plus className="h-4 w-4" />
              정비항목 추가
            </Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.scheduled)}>
              <CalendarClock className="h-4 w-4" />
              정비예정 추가
            </Button>
          </div>
        }
      />

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
          <p className="text-sm text-muted">저장공간 사용량</p>
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
              <p className="font-semibold text-text">경고 / 알림</p>
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <SectionTitle
            title="주행거리 갱신"
            description="이전 기록보다 작은 값은 기본적으로 막고, 예외 상황이면 강제 저장을 허용합니다."
          />
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
                placeholder="예: 주유 후 계기판 확인"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                checked={forceSave}
                onChange={(event) => setForceSave(event.target.checked)}
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-panelAlt"
              />
              예외 상황이라면 이전 기록보다 작은 값도 강제 저장
            </label>
            {odometerError ? <p className="text-sm text-danger">{odometerError}</p> : null}
            <Button type="submit" className="w-full sm:w-fit">
              주행거리 갱신
            </Button>
          </form>
        </Card>

        <Card>
          <SectionTitle title="빠른 액션" description="자주 쓰는 기능을 바로 실행합니다." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button onClick={() => navigate(ROUTES.records)}>
              <Wrench className="h-4 w-4" />
              정비항목 추가
            </Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.scheduled)}>
              <CalendarClock className="h-4 w-4" />
              정비예정 추가
            </Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.statistics)}>
              <ArrowRight className="h-4 w-4" />
              통계 보기
            </Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.backups)}>
              <ArrowRight className="h-4 w-4" />
              데이터 백업
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <SectionTitle
            title="정비예정 요약"
            description="정비 요망과 곧 예정 항목이 먼저 보이도록 정렬합니다."
          />
          <div className="mt-5 space-y-3">
            {(scheduledItems ?? []).length === 0 ? (
              <p className="text-sm text-muted">등록된 정비예정이 없습니다.</p>
            ) : (
              scheduledItems?.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-panelAlt p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        예정일 {formatShortDate(item.scheduledDate)} / 목표{' '}
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
          <SectionTitle
            title="최근 정비내역"
            description="최근 입력한 정비와 비용을 날짜순으로 보여줍니다."
          />
          <div className="mt-5 space-y-3">
            {recentRecords.length === 0 ? (
              <p className="text-sm text-muted">아직 정비내역이 없습니다.</p>
            ) : (
              recentRecords.map((record) => (
                <div key={record.id} className="rounded-2xl border border-border bg-panelAlt p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {record.items.map((item) => item.label).join(', ')}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {formatShortDate(record.date)} · {formatKilometers(record.odometerKm)} ·{' '}
                        {record.shopName || '업체명 미입력'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(record.totalCost)}</p>
                      <p className="text-sm text-muted">
                        사진 {record.photos.length}장 / 영수증 {record.receiptPhotos.length}장
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="최근 업로드 사진"
          description="대표 사진과 최근 업로드 이미지를 모아 보여줍니다."
        />
        {recentPhotos.length === 0 ? (
          <p className="mt-4 text-sm text-muted">업로드된 사진이 없습니다.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentPhotos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-3xl border border-border bg-panelAlt"
              >
                <img
                  src={getAttachmentUrl(settings, photo.path)}
                  alt={photo.originalFileName}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="truncate text-text">{photo.originalFileName}</span>
                  <Camera className="h-4 w-4 text-muted" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
