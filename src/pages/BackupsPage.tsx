import { useRef, useState } from 'react'

import { useApp } from '../context/AppContext'
import { downloadTextFile } from '../lib/utils'
import { Button, Card, EmptyState, PageHero, SectionTitle } from '../components/ui'

const normalizeCsvValue = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export const BackupsPage = () => {
  const { exportData, importData, userBundle, session } = useApp()
  const [status, setStatus] = useState<string | null>(null)
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
      'application/json',
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
    )
    setStatus('정비내역을 CSV로 내보냈습니다.')
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      await importData(payload)
      setStatus('JSON 백업 데이터를 현재 계정으로 가져왔습니다.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '가져오기에 실패했습니다.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="백업 / 가져오기"
        description="전체 JSON export/import, CSV export를 제공합니다. 이미지 파일 자체는 포함되지 않고 GitHub 경로 참조를 유지합니다."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle
            title="내보내기"
            description="현재 로그인 차량의 전체 데이터와 CSV를 다운로드합니다."
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleJsonExport}>전체 JSON export</Button>
            <Button variant="secondary" onClick={handleCsvExport}>
              정비내역 CSV export
            </Button>
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="가져오기"
            description="같은 차량번호의 백업 JSON만 덮어쓰기 import 가능합니다."
          />
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => importInputRef.current?.click()}>전체 JSON import</Button>
            <Button variant="ghost" onClick={() => setStatus(null)}>
              상태 메시지 지우기
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <p className="text-sm font-semibold">운영 메모</p>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
          <li>첨부 이미지는 별도 GitHub 파일 경로를 사용하므로 export JSON에 바이너리를 넣지 않습니다.</li>
          <li>대규모 import 전에는 JSON export를 먼저 떠두는 편이 안전합니다.</li>
          <li>삭제 전 확인 모달과 함께 사용하는 것이 권장됩니다.</li>
        </ul>
        {status ? <p className="mt-5 text-sm text-accentSoft">{status}</p> : null}
      </Card>
    </div>
  )
}
