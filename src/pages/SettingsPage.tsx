import { MoonStar, SunMedium } from 'lucide-react'

import { Card, ProgressBar } from '../components/ui'
import { useApp } from '../context/AppContext'
import { formatBytes } from '../lib/format'

export const SettingsPage = () => {
  const { settings, saveSettings, userBundle } = useApp()

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
      <div className="rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">설정</h1>
      </div>

      <Card className="max-w-3xl">
        <p className="text-sm text-muted">테마</p>
        <div className="mt-4 grid gap-3 rounded-[1.75rem] border border-border bg-panelAlt p-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => saveSettings({ theme: 'dark' })}
            className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
              settings.theme === 'dark'
                ? 'border-accent/50 bg-panel text-text shadow-panel'
                : 'border-transparent text-muted hover:border-border hover:text-text'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg text-accentSoft">
                <MoonStar className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">다크</p>
                <p className="mt-1 text-sm text-muted">차분한 기본 테마</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => saveSettings({ theme: 'light' })}
            className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
              settings.theme === 'light'
                ? 'border-accent/50 bg-panel text-text shadow-panel'
                : 'border-transparent text-muted hover:border-border hover:text-text'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg text-warn">
                <SunMedium className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">라이트</p>
                <p className="mt-1 text-sm text-muted">밝고 선명한 테마</p>
              </div>
            </div>
          </button>
        </div>
      </Card>

      <Card className="max-w-2xl">
        <p className="text-sm text-muted">업로드 가능 용량</p>
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
