import { ListFilter, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Select,
} from '../components/ui'
import { ROUTES } from '../constants/app'
import { MAINTENANCE_CATEGORIES } from '../constants/maintenanceItems'
import { useApp } from '../context/appContextStore'
import {
  buildMaintenanceRecordDraftFromRecord,
  getMaintenancePhotoCaption,
  persistMaintenanceRecordDraft,
} from '../features/maintenanceRecords'
import { formatCurrency, formatKilometers, formatShortDate } from '../lib/format'
import { getAttachmentUrl } from '../services/carDiaryRepository'
import type { RecordSortKey } from '../types/models'

const EMPTY_RECORDS = [] as const

export const MaintenanceRecordListPage = () => {
  const navigate = useNavigate()
  const { userBundle, deleteMaintenanceRecord, isReadOnly, settings } = useApp()
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [minCost, setMinCost] = useState('')
  const [maxCost, setMaxCost] = useState('')
  const [sortKey, setSortKey] = useState<RecordSortKey>('date')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)

  const records = userBundle?.maintenanceRecords.records ?? EMPTY_RECORDS

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return [...records]
      .filter((record) => {
        const matchesQuery =
          !normalizedQuery ||
          record.items.some((item) => item.label.toLowerCase().includes(normalizedQuery)) ||
          record.shopName.toLowerCase().includes(normalizedQuery) ||
          record.notes.toLowerCase().includes(normalizedQuery)
        const matchesDateFrom = !dateFrom || record.date >= dateFrom
        const matchesDateTo = !dateTo || record.date <= dateTo
        const matchesItem =
          !itemFilter || record.items.some((item) => item.code === itemFilter)
        const matchesMin = !minCost || record.totalCost >= Number(minCost)
        const matchesMax = !maxCost || record.totalCost <= Number(maxCost)

        return (
          matchesQuery &&
          matchesDateFrom &&
          matchesDateTo &&
          matchesItem &&
          matchesMin &&
          matchesMax
        )
      })
      .sort((left, right) => {
        if (sortKey === 'cost') return right.totalCost - left.totalCost
        if (sortKey === 'odometer') return right.odometerKm - left.odometerKm
        return right.date.localeCompare(left.date)
      })
  }, [dateFrom, dateTo, itemFilter, maxCost, minCost, query, records, sortKey])

  if (!userBundle) {
    return null
  }

  const resetFilters = () => {
    setQuery('')
    setDateFrom('')
    setDateTo('')
    setItemFilter('')
    setMinCost('')
    setMaxCost('')
    setSortKey('date')
  }

  const openEdit = (recordId: string, mode: 'edit' | 'clone') => {
    const record = records.find((item) => item.id === recordId)
    if (!record) return

    const nextDraft = buildMaintenanceRecordDraftFromRecord(
      userBundle.profile.vehicleId,
      record,
    )
    persistMaintenanceRecordDraft(
      mode === 'edit'
        ? nextDraft
        : {
            ...nextDraft,
            id: undefined,
            existingPhotos: [],
            existingReceipts: [],
            newPhotos: [],
            newReceipts: [],
            representativePhotoId: null,
          },
    )
    navigate(ROUTES.records)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
              Record List
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">정비목록</h1>
          </div>
          <Button onClick={() => navigate(ROUTES.records)}>
            <Plus className="h-4 w-4" />
            정비내역 등록
          </Button>
        </div>
      </div>

      <Card>
        <SectionTitle
          title="필터"
          action={
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              초기화
            </Button>
          }
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="검색">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="정비항목, 업체명, 메모"
            />
          </Field>
          <Field label="정비항목">
            <Select value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}>
              <option value="">전체</option>
              {MAINTENANCE_CATEGORIES.flatMap((category) =>
                category.items.map((item) => (
                  <option key={item.code} value={item.code}>
                    {category.label} · {item.label}
                  </option>
                )),
              )}
            </Select>
          </Field>
          <Field label="시작일">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </Field>
          <Field label="종료일">
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </Field>
          <Field label="최소 비용">
            <Input type="number" value={minCost} onChange={(event) => setMinCost(event.target.value)} />
          </Field>
          <Field label="최대 비용">
            <Input type="number" value={maxCost} onChange={(event) => setMaxCost(event.target.value)} />
          </Field>
          <Field label="정렬">
            <Select value={sortKey} onChange={(event) => setSortKey(event.target.value as RecordSortKey)}>
              <option value="date">날짜순</option>
              <option value="cost">비용순</option>
              <option value="odometer">주행거리순</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <div className="flex h-11 w-full items-center justify-center rounded-2xl border border-border bg-panelAlt text-sm text-muted">
              <ListFilter className="mr-2 h-4 w-4" />
              {filteredRecords.length}건
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="목록" />
        <div className="mt-5 space-y-4">
          {filteredRecords.length === 0 ? (
            <EmptyState
              title="표시할 정비내역이 없습니다."
              description="필터를 줄이거나 새 정비내역을 등록하세요."
              action={
                <Button onClick={() => navigate(ROUTES.records)}>
                  <Plus className="h-4 w-4" />
                  정비내역 등록
                </Button>
              }
            />
          ) : (
            filteredRecords.map((record) => (
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
                      {record.shopName || '-'} · 부품비 {formatCurrency(record.partsCost)} · 공임비{' '}
                      {formatCurrency(record.laborCost)}
                    </p>
                    {record.notes ? (
                      <p className="mt-2 text-sm leading-6 text-muted">{record.notes}</p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <p className="text-right text-lg font-semibold">
                      {formatCurrency(record.totalCost)}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(record.id, 'edit')}>
                        수정
                      </Button>
                      <Button variant="ghost" onClick={() => openEdit(record.id, 'clone')}>
                        복제
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setDeleteTargetId(record.id)}
                        disabled={isReadOnly || deletingRecordId !== null}
                      >
                        <Trash2 className="h-4 w-4" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>

                {record.photos.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-3 text-sm font-medium text-text">사진 {record.photos.length}장</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                            <p className="truncate text-sm text-text">
                              {getMaintenancePhotoCaption(record, photo.relatedItemCodes)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {record.receiptPhotos.length > 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    영수증 {record.receiptPhotos.length}장
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        open={Boolean(deleteTargetId)}
        title="정비내역 삭제"
        description="삭제하면 연결된 사진, 영수증, 주행거리 이력도 함께 정리됩니다."
        onClose={() => setDeleteTargetId(null)}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (!deleteTargetId) return
              try {
                setDeletingRecordId(deleteTargetId)
                await deleteMaintenanceRecord(deleteTargetId)
                setDeleteTargetId(null)
              } finally {
                setDeletingRecordId(null)
              }
            }}
            loading={deletingRecordId === deleteTargetId}
            loadingLabel="삭제 중"
          >
            삭제 확인
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setDeleteTargetId(null)}
            disabled={deletingRecordId !== null}
          >
            취소
          </Button>
        </div>
      </Modal>
    </div>
  )
}
