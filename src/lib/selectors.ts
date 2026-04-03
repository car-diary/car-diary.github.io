import { differenceInCalendarDays, format, parseISO, startOfMonth, subMonths } from 'date-fns'

import {
  SOON_DUE_DAY_THRESHOLD,
  SOON_DUE_KM_THRESHOLD,
} from '../constants/app'
import type {
  DashboardAlert,
  DashboardSummary,
  MonthlyTrendPoint,
  StatisticsSnapshot,
  UserBundle,
} from '../types/models'

const getMonthKey = (value: string) => format(parseISO(value), 'yyyy-MM')
const getYearKey = (value: string) => format(parseISO(value), 'yyyy')

export const buildDashboardSummary = (bundle: UserBundle): DashboardSummary => {
  const now = new Date()
  const currentMonthKey = format(now, 'yyyy-MM')
  const currentYearKey = format(now, 'yyyy')

  const monthlySpend = bundle.maintenanceRecords.records
    .filter((record) => getMonthKey(record.date) === currentMonthKey)
    .reduce((total, record) => total + record.totalCost, 0)

  const yearlyRecords = bundle.maintenanceRecords.records.filter(
    (record) => getYearKey(record.date) === currentYearKey,
  )

  const urgentAlerts: DashboardAlert[] = bundle.scheduledMaintenance.items
    .filter((item) => item.status === 'pending')
    .flatMap((item) => {
      const alerts: DashboardAlert[] = []
      if (
        item.targetOdometerKm !== null &&
        bundle.profile.currentOdometerKm >= item.targetOdometerKm
      ) {
        alerts.push({
          id: `${item.id}-km-over`,
          tone: 'danger',
          title: '정비 요망',
          description: `${item.title} 목표 주행거리 도달`,
          scheduleId: item.id,
        })
      } else if (
        item.targetOdometerKm !== null &&
        item.targetOdometerKm - bundle.profile.currentOdometerKm <=
          SOON_DUE_KM_THRESHOLD
      ) {
        alerts.push({
          id: `${item.id}-km-soon`,
          tone: 'warn',
          title: '곧 정비 예정',
          description: `${item.title}까지 ${Math.max(
            item.targetOdometerKm - bundle.profile.currentOdometerKm,
            0,
          )}km`,
          scheduleId: item.id,
        })
      }

      if (item.scheduledDate) {
        const dayDiff = differenceInCalendarDays(parseISO(item.scheduledDate), now)
        if (dayDiff < 0) {
          alerts.push({
            id: `${item.id}-date-over`,
            tone: 'danger',
            title: '예정일 경과',
            description: `${item.title} ${Math.abs(dayDiff)}일 지연`,
            scheduleId: item.id,
          })
        } else if (dayDiff <= SOON_DUE_DAY_THRESHOLD) {
          alerts.push({
            id: `${item.id}-date-soon`,
            tone: 'info',
            title: '곧 정비 예정',
            description: `${item.title} ${dayDiff}일 남음`,
            scheduleId: item.id,
          })
        }
      }

      return alerts
    })

  return {
    monthlySpend,
    yearlySpend: yearlyRecords.reduce((total, record) => total + record.totalCost, 0),
    latestOdometerKm: bundle.profile.currentOdometerKm,
    maintenanceCountThisYear: yearlyRecords.length,
    pendingSchedules: bundle.scheduledMaintenance.items.filter(
      (item) => item.status === 'pending',
    ).length,
    urgentAlerts,
  }
}

export const buildStatisticsSnapshot = (bundle: UserBundle): StatisticsSnapshot => {
  const monthlyTrend: MonthlyTrendPoint[] = Array.from({ length: 12 }).map(
    (_, index) => {
      const month = subMonths(startOfMonth(new Date()), 11 - index)
      const key = format(month, 'yyyy-MM')
      const records = bundle.maintenanceRecords.records.filter(
        (record) => getMonthKey(record.date) === key,
      )
      const relevantEntries = bundle.odometerHistory.entries.filter(
        (entry) => getMonthKey(entry.recordedAt) === key,
      )
      const distanceKm =
        relevantEntries.length >= 2
          ? relevantEntries.at(-1)!.odometerKm - relevantEntries[0]!.odometerKm
          : 0
      return {
        month: key,
        label: format(month, 'MM월'),
        distanceKm: Math.max(distanceKm, 0),
        spend: records.reduce((total, record) => total + record.totalCost, 0),
        recordCount: records.length,
      }
    },
  )

  const yearBuckets = new Map<
    string,
    {
      spend: number
      distances: number[]
    }
  >()

  monthlyTrend.forEach((point) => {
    const year = point.month.slice(0, 4)
    const current = yearBuckets.get(year) ?? { spend: 0, distances: [] }
    current.spend += point.spend
    current.distances.push(point.distanceKm)
    yearBuckets.set(year, current)
  })

  const annualMetrics = [...yearBuckets.entries()].map(([year, bucket]) => ({
    year,
    averageMileageKm:
      bucket.distances.length === 0
        ? 0
        : Number(
            (
              bucket.distances.reduce((total, value) => total + value, 0) /
              bucket.distances.length
            ).toFixed(1),
          ),
    averageSpend:
      bucket.distances.length === 0
        ? 0
        : Number((bucket.spend / bucket.distances.length).toFixed(1)),
  }))

  const spendByItem = new Map<string, number>()
  const recordCountByItem = new Map<string, number>()
  bundle.maintenanceRecords.records.forEach((record) => {
    record.items.forEach((item) => {
      spendByItem.set(item.label, (spendByItem.get(item.label) ?? 0) + record.totalCost)
      recordCountByItem.set(item.label, (recordCountByItem.get(item.label) ?? 0) + 1)
    })
  })

  const spendingByItem = [...spendByItem.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)

  const topSpendItems = spendingByItem.slice(0, 5)

  const recentItemSnapshots = [...recordCountByItem.keys()].slice(0, 6).map((itemLabel) => {
    const lastRecord = bundle.maintenanceRecords.records.find((record) =>
      record.items.some((item) => item.label === itemLabel),
    )
    return {
      itemLabel,
      lastDate: lastRecord?.date ?? null,
      lastOdometerKm: lastRecord?.odometerKm ?? null,
    }
  })

  const totalDistance = monthlyTrend.reduce((total, point) => total + point.distanceKm, 0)
  const totalSpend = monthlyTrend.reduce((total, point) => total + point.spend, 0)

  return {
    annualMetrics,
    monthlyTrend,
    spendingByItem,
    recordCountByItem: [...recordCountByItem.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    topSpendItems,
    recentItemSnapshots,
    estimatedCostPerKm: totalDistance > 0 ? Number((totalSpend / totalDistance).toFixed(1)) : 0,
  }
}
