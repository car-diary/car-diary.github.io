import { Card, ProgressBar } from '../components/ui'
import { useApp } from '../context/AppContext'
import { formatBytes } from '../lib/format'

export const SettingsPage = () => {
  const { userBundle } = useApp()

  if (!userBundle) {
    return null
  }

  const remainingBytes = Math.max(
    0,
    userBundle.storageSummary.limitBytes - userBundle.storageSummary.usedBytes,
  )

  const progressTone =
    userBundle.storageSummary.percentUsed >= 95
      ? 'danger'
      : userBundle.storageSummary.percentUsed >= 75
        ? 'warn'
        : 'info'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
            Storage
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">업로드 가능 용량</h1>
        </div>
      </div>

      <Card className="max-w-2xl">
        <p className="text-sm text-muted">남은 용량</p>
        <p className="mt-3 text-4xl font-semibold">{formatBytes(remainingBytes)}</p>
        <p className="mt-2 text-sm text-muted">
          사용 중 {formatBytes(userBundle.storageSummary.usedBytes)} / 전체{' '}
          {formatBytes(userBundle.storageSummary.limitBytes)}
        </p>
        <div className="mt-5">
          <ProgressBar
            value={userBundle.storageSummary.percentUsed}
            tone={progressTone}
          />
        </div>
      </Card>
    </div>
  )
}
