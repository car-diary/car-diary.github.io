import type {
  AttachmentPhoto,
  StorageBreakdownItem,
  StorageUsageSummary,
  UserBundle,
} from '../types/models'

const jsonByteLength = (value: unknown) =>
  new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }).size

const attachmentBreakdown = (
  attachments: AttachmentPhoto[],
): StorageBreakdownItem[] =>
  attachments.map((attachment) => ({
    path: attachment.path,
    bytes: attachment.bytes,
    kind: attachment.kind,
  }))

export const calculateStorageUsageSummary = (
  bundle: Omit<UserBundle, 'storageSummary'>,
  limitBytes: number,
): StorageUsageSummary => {
  const jsonBreakdown: StorageBreakdownItem[] = [
    {
      path: 'profile.json',
      bytes: jsonByteLength(bundle.profile),
      kind: 'json',
    },
    {
      path: 'odometer-history.json',
      bytes: jsonByteLength(bundle.odometerHistory),
      kind: 'json',
    },
    {
      path: 'maintenance-records.json',
      bytes: jsonByteLength(bundle.maintenanceRecords),
      kind: 'json',
    },
    {
      path: 'scheduled-maintenance.json',
      bytes: jsonByteLength(bundle.scheduledMaintenance),
      kind: 'json',
    },
  ]

  const attachments = bundle.maintenanceRecords.records.flatMap((record) => [
    ...record.photos,
    ...record.receiptPhotos,
  ])

  const attachmentBytes = attachments.reduce(
    (total, attachment) => total + attachment.bytes,
    0,
  )
  const jsonBytes = jsonBreakdown.reduce((total, item) => total + item.bytes, 0)
  const usedBytes = jsonBytes + attachmentBytes

  return {
    vehicleId: bundle.profile.vehicleId,
    limitBytes,
    usedBytes,
    jsonBytes,
    attachmentBytes,
    percentUsed: Number(((usedBytes / limitBytes) * 100).toFixed(2)),
    fileBreakdown: [...jsonBreakdown, ...attachmentBreakdown(attachments)],
    updatedAt: new Date().toISOString(),
  }
}
