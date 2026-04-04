import { useRef, useState } from 'react'

import { useApp } from '../context/appContextStore'
import { downloadTextFile, readTextFile } from '../lib/utils'
import { Button, Card, EmptyState, SectionTitle } from '../components/ui'

const normalizeCsvValue = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export const BackupsPage = () => {
  const { exportData, importData, userBundle, session } = useApp()
  const [status, setStatus] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  if (!userBundle || !session) {
    return (
      <EmptyState
        title="로그인이 필요합니다."
        description="백업과 가져오기는 로그인 후 사용할 수 있습니다."
      />
    )
  }

  const handleJsonExport = () => {
    const payload = exportData()
    if (!payload) return
    downloadTextFile(
      `${session.vehicleId}-backup.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
      true,
    )
    setStatus('전체 데이터를 JSON으로 내보냈습니다.')
  }

  const handleCsvExport = () => {
    const csvRows = [
      [
        'date',
        'odometerKm',
        'items',
        'shopName',
        'partsCost',
        'laborCost',
        'totalCost',
        'notes',
      ].join(','),
      ...userBundle.maintenanceRecords.records.map((record) =>
        [
          normalizeCsvValue(record.date),
          normalizeCsvValue(record.odometerKm),
          normalizeCsvValue(record.items.map((item) => item.label).join(' / ')),
          normalizeCsvValue(record.shopName),
          normalizeCsvValue(record.partsCost),
          normalizeCsvValue(record.laborCost),
          normalizeCsvValue(record.totalCost),
          normalizeCsvValue(record.notes),
        ].join(','),
      ),
    ]
    downloadTextFile(
      `${session.vehicleId}-maintenance.csv`,
      csvRows.join('\n'),
      'text/csv;charset=utf-8',
      true,
    )
    setStatus('정비내역을 CSV로 내보냈습니다.')
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setIsImporting(true)
      const payload = JSON.parse(await readTextFile(file))
      await importData(payload)
      setStatus('JSON 백업 데이터를 현재 계정으로 가져왔습니다.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '가져오기에 실패했습니다.')
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
          Backup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">백업 / 가져오기</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle title="내보내기" />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleJsonExport}>전체 JSON export</Button>
            <Button variant="secondary" onClick={handleCsvExport}>
              정비내역 CSV export
            </Button>
          </div>
        </Card>

        <Card>
          <SectionTitle title="가져오기" />
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => importInputRef.current?.click()}
              loading={isImporting}
              loadingLabel="가져오는 중"
            >
              전체 JSON import
            </Button>
            <Button variant="ghost" onClick={() => setStatus(null)}>
              상태 메시지 지우기
            </Button>
          </div>
        </Card>
      </div>

      {status ? (
        <Card>
          <p className="text-sm text-accentSoft">{status}</p>
        </Card>
      ) : null}
    </div>
  )
}
