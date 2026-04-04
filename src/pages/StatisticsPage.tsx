import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useApp } from '../context/appContextStore'
import { formatCurrency, formatKilometers, formatShortDate } from '../lib/format'
import { Card, EmptyState, SectionTitle } from '../components/ui'

const PIE_COLORS = ['#6cb7ff', '#49d39a', '#f4ba53', '#ff7d7d', '#8dd6ff', '#7bc7ba']

export const StatisticsPage = () => {
  const { statistics, userBundle } = useApp()

  if (!userBundle || !statistics) {
    return null
  }

  if (userBundle.maintenanceRecords.records.length === 0) {
    return (
      <EmptyState
        title="통계를 만들 데이터가 없습니다."
        description="정비내역을 하나 이상 추가하면 월별 비용과 주행거리 추이를 바로 확인할 수 있습니다."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
          Statistics
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">정비 통계</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">km당 유지비 추정</p>
          <p className="mt-4 text-3xl font-semibold">
            {formatCurrency(statistics.estimatedCostPerKm)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">최근 12개월 정비건수</p>
          <p className="mt-4 text-3xl font-semibold">
            {userBundle.maintenanceRecords.records.length}건
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">현재 누적 주행거리</p>
          <p className="mt-4 text-3xl font-semibold">
            {formatKilometers(userBundle.profile.currentOdometerKm)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">가장 최근 정비일</p>
          <p className="mt-4 text-3xl font-semibold">
            {formatShortDate(userBundle.maintenanceRecords.records[0]?.date ?? null)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle title="월별 주행거리" />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={statistics.monthlyTrend}>
                <CartesianGrid stroke="#223246" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#9ba7ba" />
                <YAxis stroke="#9ba7ba" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="distanceKm"
                  stroke="#6cb7ff"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionTitle title="월별 정비비" />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statistics.monthlyTrend}>
                <CartesianGrid stroke="#223246" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#9ba7ba" />
                <YAxis stroke="#9ba7ba" />
                <Tooltip />
                <Bar dataKey="spend" fill="#49d39a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <SectionTitle title="연도별 평균" />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statistics.annualMetrics}>
                <CartesianGrid stroke="#223246" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="#9ba7ba" />
                <YAxis stroke="#9ba7ba" />
                <Tooltip />
                <Bar dataKey="averageMileageKm" fill="#6cb7ff" radius={[8, 8, 0, 0]} />
                <Bar dataKey="averageSpend" fill="#f4ba53" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionTitle title="정비항목별 지출 비중" />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statistics.spendingByItem}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={108}
                  paddingAngle={3}
                >
                  {statistics.spendingByItem.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle title="항목별 정비 건수" />
          <div className="mt-5 space-y-3">
            {statistics.recordCountByItem.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-2xl border border-border bg-panelAlt px-4 py-3"
              >
                <span className="text-sm text-text">{item.name}</span>
                <span className="text-sm font-semibold text-accentSoft">{item.count}회</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle title="최근 정비 스냅샷" />
          <div className="mt-5 space-y-3">
            {statistics.recentItemSnapshots.map((item) => (
              <div
                key={item.itemLabel}
                className="rounded-2xl border border-border bg-panelAlt px-4 py-3"
              >
                <p className="font-medium text-text">{item.itemLabel}</p>
                <p className="mt-1 text-sm text-muted">
                  마지막 정비일 {formatShortDate(item.lastDate)} / 당시 주행거리{' '}
                  {item.lastOdometerKm ? formatKilometers(item.lastOdometerKm) : '-'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
