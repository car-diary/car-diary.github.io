import { LOCAL_STORAGE_KEYS } from '../constants/app'
import { MAINTENANCE_ITEM_LOOKUP } from '../constants/maintenanceItems'
import {
  readVehicleScopedDraft,
  writeVehicleScopedDraft,
} from '../lib/draftStorage'
import { calculateTotalCost } from '../lib/validation'
import type { MaintenanceRecord, MaintenanceRecordDraft } from '../types/models'

const today = () => new Date().toISOString().slice(0, 10)

export const createEmptyMaintenanceRecordDraft = (
  vehicleId: string,
  currentOdometerKm: number,
): MaintenanceRecordDraft => ({
  vehicleId,
  date: today(),
  odometerKm: currentOdometerKm,
  selectedItemCodes: [],
  customItemsText: '',
  shopName: '',
  partsCost: 0,
  laborCost: 0,
  totalCost: 0,
  notes: '',
  representativePhotoId: null,
  existingPhotos: [],
  existingReceipts: [],
  newPhotos: [],
  newReceipts: [],
  scheduledSourceId: null,
})

export const buildMaintenanceRecordDraftFromRecord = (
  vehicleId: string,
  record: MaintenanceRecord,
): MaintenanceRecordDraft => ({
  id: record.id,
  vehicleId,
  date: record.date,
  odometerKm: record.odometerKm,
  selectedItemCodes: record.items.map((item) => item.code),
  customItemsText: record.customItemsText,
  shopName: record.shopName,
  partsCost: record.partsCost,
  laborCost: record.laborCost,
  totalCost: record.totalCost,
  notes: record.notes,
  representativePhotoId: record.representativePhotoId,
  existingPhotos: record.photos,
  existingReceipts: record.receiptPhotos,
  newPhotos: [],
  newReceipts: [],
  scheduledSourceId: record.scheduledSourceId,
})

export const serializeMaintenanceRecordDraft = (draft: MaintenanceRecordDraft) => ({
  ...draft,
  newPhotos: [],
  newReceipts: [],
})

export const readMaintenanceRecordDraft = (
  vehicleId: string,
  currentOdometerKm: number,
) => {
  const baseDraft = createEmptyMaintenanceRecordDraft(vehicleId, currentOdometerKm)
  const stored = readVehicleScopedDraft<MaintenanceRecordDraft>(
    LOCAL_STORAGE_KEYS.recordDraft,
    vehicleId,
  )
  const nextDraft: MaintenanceRecordDraft = {
    ...baseDraft,
    ...stored,
    vehicleId,
    odometerKm: stored.id ? stored.odometerKm ?? baseDraft.odometerKm : currentOdometerKm,
    totalCost:
      typeof stored.totalCost === 'number'
        ? stored.totalCost
        : calculateTotalCost(
            typeof stored.partsCost === 'number' ? stored.partsCost : baseDraft.partsCost,
            typeof stored.laborCost === 'number' ? stored.laborCost : baseDraft.laborCost,
          ),
    newPhotos: [],
    newReceipts: [],
  }

  return nextDraft
}

export const persistMaintenanceRecordDraft = (draft: MaintenanceRecordDraft) => {
  writeVehicleScopedDraft(
    LOCAL_STORAGE_KEYS.recordDraft,
    draft.vehicleId,
    serializeMaintenanceRecordDraft(draft),
  )
}

export const clearMaintenanceRecordDraft = (
  vehicleId: string,
  currentOdometerKm: number,
) => {
  const draft = createEmptyMaintenanceRecordDraft(vehicleId, currentOdometerKm)
  persistMaintenanceRecordDraft(draft)
  return draft
}

export const getMaintenancePhotoCaption = (
  record: MaintenanceRecord,
  itemCodes: string[] | undefined,
) => {
  if (!itemCodes || itemCodes.length === 0) {
    return record.items[0]?.label ?? '정비 사진'
  }

  const labels = itemCodes
    .map((code) => MAINTENANCE_ITEM_LOOKUP.get(code)?.label)
    .filter(Boolean)

  return labels.length > 0 ? labels.join(', ') : record.items[0]?.label ?? '정비 사진'
}
