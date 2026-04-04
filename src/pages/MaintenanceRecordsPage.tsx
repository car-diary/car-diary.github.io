import { ImagePlus, List, RotateCcw, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  TextArea,
} from '../components/ui'
import { ROUTES } from '../constants/app'
import { MAINTENANCE_CATEGORIES } from '../constants/maintenanceItems'
import { useApp } from '../context/appContextStore'
import {
  clearMaintenanceRecordDraft,
  persistMaintenanceRecordDraft,
  readMaintenanceRecordDraft,
} from '../features/maintenanceRecords'
import { formatKilometers } from '../lib/format'
import { calculateTotalCost } from '../lib/validation'
import type { MaintenanceRecordDraft } from '../types/models'

const parseNumberInput = (value: string) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0
}

type NumericFieldKey = 'odometerKm' | 'partsCost' | 'laborCost' | 'totalCost'

type NumericFieldState = Record<NumericFieldKey, string>

const buildNumericFieldState = (draft: MaintenanceRecordDraft): NumericFieldState => ({
  odometerKm: String(draft.odometerKm),
  partsCost: String(draft.partsCost),
  laborCost: String(draft.laborCost),
  totalCost: String(draft.totalCost),
})

interface MaintenanceRecordEditorProps {
  vehicleId: string
  currentOdometerKm: number
  isReadOnly: boolean
  saveMaintenanceRecord: (draft: MaintenanceRecordDraft) => Promise<void>
}

const MaintenanceRecordEditor = ({
  vehicleId,
  currentOdometerKm,
  isReadOnly,
  saveMaintenanceRecord,
}: MaintenanceRecordEditorProps) => {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<MaintenanceRecordDraft>(() =>
    readMaintenanceRecordDraft(vehicleId, currentOdometerKm),
  )
  const [numericFields, setNumericFields] = useState<NumericFieldState>(() =>
    buildNumericFieldState(readMaintenanceRecordDraft(vehicleId, currentOdometerKm)),
  )
  const [isTotalCostManual, setIsTotalCostManual] = useState(() => {
    const initialDraft = readMaintenanceRecordDraft(vehicleId, currentOdometerKm)
    return initialDraft.totalCost !== calculateTotalCost(initialDraft.partsCost, initialDraft.laborCost)
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    persistMaintenanceRecordDraft(draft)
  }, [draft])

  const resetDraft = () => {
    const nextDraft = clearMaintenanceRecordDraft(vehicleId, currentOdometerKm)
    setDraft(nextDraft)
    setNumericFields(buildNumericFieldState(nextDraft))
    setIsTotalCostManual(false)
    setFormError(null)
  }

  const updateDraft = (updater: (current: MaintenanceRecordDraft) => MaintenanceRecordDraft) => {
    setDraft((current) => updater(current))
  }

  const handleCostChange = (field: 'partsCost' | 'laborCost', rawValue: string) => {
    setNumericFields((current) => {
      const next = { ...current, [field]: rawValue }
      if (!isTotalCostManual) {
        const partsCost = parseNumberInput(field === 'partsCost' ? rawValue : next.partsCost)
        const laborCost = parseNumberInput(field === 'laborCost' ? rawValue : next.laborCost)
        next.totalCost = String(calculateTotalCost(partsCost, laborCost))
      }
      return next
    })

    updateDraft((current) => {
      const nextValue = parseNumberInput(rawValue)
      const nextDraft = {
        ...current,
        [field]: nextValue,
      }
      const nextCalculated = calculateTotalCost(nextDraft.partsCost, nextDraft.laborCost)

      return {
        ...nextDraft,
        totalCost: isTotalCostManual ? current.totalCost : nextCalculated,
      }
    })
  }

  const handleOdometerChange = (rawValue: string) => {
    setNumericFields((current) => ({ ...current, odometerKm: rawValue }))
    updateDraft((current) => ({
      ...current,
      odometerKm: parseNumberInput(rawValue),
    }))
  }

  const handleTotalCostChange = (rawValue: string) => {
    setIsTotalCostManual(true)
    setNumericFields((current) => ({ ...current, totalCost: rawValue }))
    updateDraft((current) => ({
      ...current,
      totalCost: parseNumberInput(rawValue),
    }))
  }

  const handleFileAppend = (
    type: 'newPhotos' | 'newReceipts',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? [])
    updateDraft((current) => ({
      ...current,
      [type]: [...current[type], ...files],
    }))
    event.target.value = ''
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.selectedItemCodes.length === 0) {
      setFormError('정비 항목을 하나 이상 선택하세요.')
      return
    }

    try {
      setIsSubmitting(true)
      await saveMaintenanceRecord(draft)
      resetDraft()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
              Record Entry
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {draft.id ? '정비내역 수정' : '정비내역 등록'}
            </h1>
            <p className="mt-3 text-sm text-muted">
              현재 주행거리 {formatKilometers(currentOdometerKm)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate(ROUTES.recordList)}>
              <List className="h-4 w-4" />
              정비목록
            </Button>
            <Button variant="ghost" onClick={resetDraft}>
              <RotateCcw className="h-4 w-4" />
              새로 작성
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <SectionTitle title={draft.id ? '정비내역 수정' : '정비내역 등록'} />
        <form className="mt-5 space-y-5" onSubmit={handleSave}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="정비일자">
              <Input
                type="date"
                value={draft.date}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, date: event.target.value }))
                }
              />
            </Field>
            <Field label="주행거리">
              <Input
                type="number"
                value={numericFields.odometerKm}
                onChange={(event) => handleOdometerChange(event.target.value)}
              />
            </Field>
            <Field label="정비업체명">
              <Input
                value={draft.shopName}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, shopName: event.target.value }))
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="부품비">
              <Input
                type="number"
                value={numericFields.partsCost}
                onChange={(event) => handleCostChange('partsCost', event.target.value)}
              />
            </Field>
            <Field label="공임비">
              <Input
                type="number"
                value={numericFields.laborCost}
                onChange={(event) => handleCostChange('laborCost', event.target.value)}
              />
            </Field>
            <Field label="총비용">
              <Input
                type="number"
                value={numericFields.totalCost}
                onChange={(event) => handleTotalCostChange(event.target.value)}
              />
            </Field>
          </div>

          <div className="rounded-3xl border border-border bg-panelAlt p-4">
            <p className="text-sm font-semibold text-text">정비 항목</p>
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
                            updateDraft((current) => ({
                              ...current,
                              selectedItemCodes: checked
                                ? current.selectedItemCodes.filter((code) => code !== item.code)
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

          <Field label="기타 직접입력">
            <Input
              value={draft.customItemsText}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  customItemsText: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="메모">
            <TextArea
              value={draft.notes}
              onChange={(event) =>
                updateDraft((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="정비 사진">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panelAlt px-4 py-8 text-center text-sm text-muted">
                <ImagePlus className="mb-3 h-5 w-5" />
                사진 업로드
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleFileAppend('newPhotos', event)}
                  disabled={isReadOnly || isSubmitting}
                />
              </label>
            </Field>

            <Field label="영수증 사진">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panelAlt px-4 py-8 text-center text-sm text-muted">
                <ImagePlus className="mb-3 h-5 w-5" />
                영수증 업로드
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleFileAppend('newReceipts', event)}
                  disabled={isReadOnly || isSubmitting}
                />
              </label>
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-panelAlt p-4 text-sm text-muted">
              기존 사진 {draft.existingPhotos.length}장
            </div>
            <div className="rounded-2xl border border-border bg-panelAlt p-4 text-sm text-muted">
              새 사진 {draft.newPhotos.length}장
            </div>
            <div className="rounded-2xl border border-border bg-panelAlt p-4 text-sm text-muted">
              영수증 {draft.existingReceipts.length + draft.newReceipts.length}장
            </div>
          </div>

          {formError ? <p className="text-sm text-danger">{formError}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              className="flex-1"
              disabled={isReadOnly}
              loading={isSubmitting}
              loadingLabel={draft.id ? '수정 중' : '저장 중'}
            >
              <Wrench className="h-4 w-4" />
              {draft.id ? '수정 저장' : '정비내역 저장'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={resetDraft}
              disabled={isSubmitting}
            >
              입력 초기화
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export const MaintenanceRecordsPage = () => {
  const { userBundle, saveMaintenanceRecord, isReadOnly } = useApp()

  if (!userBundle) {
    return null
  }

  return (
    <MaintenanceRecordEditor
      key={userBundle.profile.vehicleId}
      vehicleId={userBundle.profile.vehicleId}
      currentOdometerKm={userBundle.profile.currentOdometerKm}
      isReadOnly={isReadOnly}
      saveMaintenanceRecord={saveMaintenanceRecord}
    />
  )
}
