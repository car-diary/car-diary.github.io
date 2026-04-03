import { ImagePlus, RotateCcw, Trash2, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
  TextArea,
} from '../components/ui'
import { LOCAL_STORAGE_KEYS } from '../constants/app'
import { MAINTENANCE_CATEGORIES, MAINTENANCE_ITEM_LOOKUP } from '../constants/maintenanceItems'
import { useApp } from '../context/AppContext'
import {
  formatCurrency,
  formatKilometers,
  formatShortDate,
} from '../lib/format'
import { safeJsonParse } from '../lib/utils'
import { calculateTotalCost } from '../lib/validation'
import { getAttachmentUrl } from '../services/carDiaryRepository'
import type { MaintenanceRecord, MaintenanceRecordDraft, RecordSortKey } from '../types/models'

const today = () => new Date().toISOString().slice(0, 10)

const createEmptyDraft = (currentOdometerKm: number): MaintenanceRecordDraft => ({
  date: today(),
  odometerKm: currentOdometerKm,
  allowLowerOdometer: false,
  selectedItemCodes: [],
  customItemsText: '',
  shopName: '',
  partsCost: 0,
  laborCost: 0,
  notes: '',
  representativePhotoId: null,
  existingPhotos: [],
  existingReceipts: [],
  newPhotos: [],
  newReceipts: [],
  scheduledSourceId: null,
})

const buildDraftFromRecord = (record: MaintenanceRecord): MaintenanceRecordDraft => ({
  id: record.id,
  date: record.date,
  odometerKm: record.odometerKm,
  allowLowerOdometer: false,
  selectedItemCodes: record.items.map((item) => item.code),
  customItemsText: record.customItemsText,
  shopName: record.shopName,
  partsCost: record.partsCost,
  laborCost: record.laborCost,
  notes: record.notes,
  representativePhotoId: record.representativePhotoId,
  existingPhotos: record.photos,
  existingReceipts: record.receiptPhotos,
  newPhotos: [],
  newReceipts: [],
  scheduledSourceId: record.scheduledSourceId,
})

const serializeDraft = (draft: MaintenanceRecordDraft) => ({
  ...draft,
  newPhotos: [],
  newReceipts: [],
})

const getPhotoCaption = (record: MaintenanceRecord, itemCodes: string[] | undefined) => {
  if (!itemCodes || itemCodes.length === 0) {
    return record.items[0]?.label ?? '정비 사진'
  }

  const labels = itemCodes
    .map((code) => MAINTENANCE_ITEM_LOOKUP.get(code)?.label)
    .filter(Boolean)

  return labels.length > 0 ? labels.join(', ') : record.items[0]?.label ?? '정비 사진'
}

export const MaintenanceRecordsPage = () => {
  const {
    userBundle,
    saveMaintenanceRecord,
    deleteMaintenanceRecord,
    isReadOnly,
    settings,
  } = useApp()
  const [draft, setDraft] = useState<MaintenanceRecordDraft | null>(null)
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [minCost, setMinCost] = useState('')
  const [maxCost, setMaxCost] = useState('')
  const [sortKey, setSortKey] = useState<RecordSortKey>('date')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!userBundle) return
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.recordDraft)
    const stored = raw
      ? safeJsonParse<Partial<MaintenanceRecordDraft>>(raw, {})
      : undefined

    setDraft({
      ...createEmptyDraft(userBundle.profile.currentOdometerKm),
      ...stored,
      newPhotos: [],
      newReceipts: [],
    })
  }, [userBundle])

  useEffect(() => {
    if (!draft) return
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.recordDraft,
      JSON.stringify(serializeDraft(draft)),
    )
  }, [draft])

  const records = userBundle?.maintenanceRecords.records ?? []

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return [...records]
      .filter((record) => {
        const matchesQuery =
          !normalizedQuery ||
          record.items.some((item) =>
            item.label.toLowerCase().includes(normalizedQuery),
          ) ||
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

  const totalCost = draft
    ? calculateTotalCost(Number(draft.partsCost), Number(draft.laborCost))
    : 0

  if (!userBundle || !draft) {
    return null
  }

  const handleFileAppend = (
    type: 'newPhotos' | 'newReceipts',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? [])
    setDraft((current) =>
      current
        ? {
            ...current,
            [type]: [...current[type], ...files],
          }
        : current,
    )
    event.target.value = ''
  }

  const resetDraft = () => {
    const nextDraft = createEmptyDraft(userBundle.profile.currentOdometerKm)
    setDraft(nextDraft)
    setFormError(null)
    localStorage.setItem(LOCAL_STORAGE_KEYS.recordDraft, JSON.stringify(nextDraft))
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.selectedItemCodes.length === 0) {
      setFormError('정비항목을 하나 이상 선택하세요.')
      return
    }

    try {
      await saveMaintenanceRecord(draft)
      resetDraft()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
              Records
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">정비내역</h1>
            <p className="mt-2 text-sm text-muted">정비항목, 비용, 사진을 같이 기록합니다.</p>
          </div>
          <Button variant="ghost" onClick={resetDraft}>
            <RotateCcw className="h-4 w-4" />
            새로 쓰기
          </Button>
        </div>
      </div>

      <Card>
        <SectionTitle title={draft.id ? '정비내역 수정' : '정비내역 입력'} />
        <form className="mt-5 space-y-5" onSubmit={handleSave}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="정비일자">
              <Input
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, date: event.target.value } : current,
                  )
                }
              />
            </Field>
            <Field label="주행거리">
              <Input
                type="number"
                value={draft.odometerKm}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, odometerKm: Number(event.target.value) }
                      : current,
                  )
                }
              />
            </Field>
            <Field label="부품비">
              <Input
                type="number"
                value={draft.partsCost}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, partsCost: Number(event.target.value) }
                      : current,
                  )
                }
              />
            </Field>
            <Field label="공임비">
              <Input
                type="number"
                value={draft.laborCost}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, laborCost: Number(event.target.value) }
                      : current,
                  )
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <Field label="정비업체명">
              <Input
                value={draft.shopName}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, shopName: event.target.value } : current,
                  )
                }
                placeholder="업체명"
              />
            </Field>
            <Field label="총비용">
              <Input value={formatCurrency(totalCost)} readOnly />
            </Field>
          </div>

          <div className="rounded-3xl border border-border bg-panelAlt p-4">
            <p className="text-sm font-semibold text-text">정비항목</p>
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
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    selectedItemCodes: checked
                                      ? current.selectedItemCodes.filter(
                                          (code) => code !== item.code,
                                        )
                                      : [...current.selectedItemCodes, item.code],
                                  }
                                : current,
                            )
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

          <Field label="기타 직접입력">
            <Input
              value={draft.customItemsText}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, customItemsText: event.target.value } : current,
                )
              }
              placeholder="필요할 때만 입력"
            />
          </Field>

          <Field label="메모">
            <TextArea
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, notes: event.target.value } : current,
                )
              }
              placeholder="작업 내용 메모"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={draft.allowLowerOdometer ?? false}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, allowLowerOdometer: event.target.checked }
                    : current,
                )
              }
            />
            현재 주행거리보다 작아도 저장
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="이 정비항목 사진">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panelAlt px-4 py-8 text-center text-sm text-muted">
                <ImagePlus className="mb-3 h-5 w-5" />
                사진 업로드
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleFileAppend('newPhotos', event)}
                  disabled={isReadOnly}
                />
              </label>
            </Field>

            <Field label="이 정비항목 영수증">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panelAlt px-4 py-8 text-center text-sm text-muted">
                <ImagePlus className="mb-3 h-5 w-5" />
                영수증 업로드
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleFileAppend('newReceipts', event)}
                  disabled={isReadOnly}
                />
              </label>
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-panelAlt p-4">
              <p className="text-sm font-medium text-text">사진</p>
              <p className="mt-2 text-sm text-muted">
                기존 {draft.existingPhotos.length}장 · 새로 추가 {draft.newPhotos.length}장
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-panelAlt p-4">
              <p className="text-sm font-medium text-text">영수증</p>
              <p className="mt-2 text-sm text-muted">
                기존 {draft.existingReceipts.length}장 · 새로 추가 {draft.newReceipts.length}장
              </p>
            </div>
          </div>

          {formError ? <p className="text-sm text-danger">{formError}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" className="flex-1" disabled={isReadOnly}>
              <Wrench className="h-4 w-4" />
              {draft.id ? '수정 저장' : '정비내역 저장'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetDraft} className="flex-1">
              입력 초기화
            </Button>
          </div>

        </form>
      </Card>

      <Card>
        <SectionTitle
          title="목록"
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setQuery('')
                setDateFrom('')
                setDateTo('')
                setItemFilter('')
                setMinCost('')
                setMaxCost('')
                setSortKey('date')
              }}
            >
              <RotateCcw className="h-4 w-4" />
              필터 초기화
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
            <Select
              value={itemFilter}
              onChange={(event) => setItemFilter(event.target.value)}
            >
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
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </Field>
          <Field label="종료일">
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </Field>
          <Field label="최소 비용">
            <Input
              type="number"
              value={minCost}
              onChange={(event) => setMinCost(event.target.value)}
            />
          </Field>
          <Field label="최대 비용">
            <Input
              type="number"
              value={maxCost}
              onChange={(event) => setMaxCost(event.target.value)}
            />
          </Field>
          <Field label="정렬">
            <Select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as RecordSortKey)}
            >
              <option value="date">날짜순</option>
              <option value="cost">비용순</option>
              <option value="odometer">주행거리순</option>
            </Select>
          </Field>
        </div>

        <div className="mt-6 space-y-4">
          {filteredRecords.length === 0 ? (
            <EmptyState
              title="조건에 맞는 정비내역이 없습니다."
              description="필터를 줄이거나 새 정비내역을 입력하세요."
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
                      {record.shopName || '업체명 미입력'} · 부품비 {formatCurrency(record.partsCost)}
                      {' · '}공임비 {formatCurrency(record.laborCost)}
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
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setDraft(buildDraftFromRecord(record))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const clone = buildDraftFromRecord(record)
                          setDraft({
                            ...clone,
                            id: undefined,
                            existingPhotos: [],
                            existingReceipts: [],
                            newPhotos: [],
                            newReceipts: [],
                            representativePhotoId: null,
                          })
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        복제
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setDeleteTargetId(record.id)}
                        disabled={isReadOnly}
                      >
                        <Trash2 className="h-4 w-4" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>

                {record.photos.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-3 text-sm font-medium text-text">
                      사진 {record.photos.length}장
                    </p>
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
                              {getPhotoCaption(record, photo.relatedItemCodes)}
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
        description="삭제하면 연결된 사진, 영수증, 주행거리 이력도 함께 정리합니다."
        onClose={() => setDeleteTargetId(null)}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (!deleteTargetId) return
              await deleteMaintenanceRecord(deleteTargetId)
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
