import { useState } from 'react'

import { useApp } from '../context/AppContext'
import { formatBytes } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHero,
  ProgressBar,
  SectionTitle,
} from '../components/ui'

export const SettingsPage = () => {
  const {
    settings,
    saveSettings,
    testGitHubConnection,
    userBundle,
    refreshAllowedUsers,
    isReadOnly,
  } = useApp()
  const [draft, setDraft] = useState(settings)
  const [status, setStatus] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const handleSave = () => {
    saveSettings(draft)
    setStatus('설정을 저장했습니다. 새 설정은 즉시 반영됩니다.')
  }

  const handleTest = async () => {
    setIsTesting(true)
    setStatus(null)
    try {
      saveSettings(draft)
      await testGitHubConnection()
      await refreshAllowedUsers()
      setStatus('GitHub 연결을 확인했습니다.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '연결 테스트에 실패했습니다.')
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="운영 설정"
        description="GitHub Repository owner/name/branch, token, 데이터 경로를 관리합니다. token은 강보안 비밀값이 아니라 가벼운 운영 편의를 위한 값으로 localStorage에 저장됩니다."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <SectionTitle
            title="GitHub 연결 설정"
            description="Contents API와 raw GitHub URL이 모두 이 값을 사용합니다."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Repository Owner">
              <Input
                value={draft.repoOwner}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, repoOwner: event.target.value }))
                }
              />
            </Field>
            <Field label="Repository Name">
              <Input
                value={draft.repoName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, repoName: event.target.value }))
                }
              />
            </Field>
            <Field label="Branch">
              <Input
                value={draft.branch}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, branch: event.target.value }))
                }
              />
            </Field>
            <Field label="Data Root Path">
              <Input
                value={draft.dataRootPath}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dataRootPath: event.target.value }))
                }
              />
            </Field>
            <Field label="Allowed Users Path">
              <Input
                value={draft.allowedUsersPath}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    allowedUsersPath: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="GitHub Token">
              <Input
                type="password"
                value={draft.token}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, token: event.target.value }))
                }
                placeholder="ghp_..."
              />
            </Field>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSave}>설정 저장</Button>
            <Button variant="secondary" onClick={handleTest} disabled={isTesting}>
              {isTesting ? '테스트 중...' : 'GitHub 연결 확인'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const cleared = { ...draft, token: '' }
                setDraft(cleared)
                saveSettings(cleared)
              }}
            >
              token 지우기
            </Button>
          </div>
          {status ? <p className="mt-4 text-sm text-muted">{status}</p> : null}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle title="운영 모드" description="쓰기 가능 여부와 저장공간 현황" />
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm text-text">현재 모드</span>
              <Badge tone={isReadOnly ? 'warn' : 'success'}>
                {isReadOnly ? '읽기 전용' : 'GitHub 직접 쓰기'}
              </Badge>
            </div>
            {userBundle ? (
              <div className="mt-5">
                <p className="text-sm text-muted">
                  {formatBytes(userBundle.storageSummary.usedBytes)} /{' '}
                  {formatBytes(userBundle.storageSummary.limitBytes)}
                </p>
                <div className="mt-3">
                  <ProgressBar
                    value={userBundle.storageSummary.percentUsed}
                    tone={
                      userBundle.storageSummary.percentUsed >= 95
                        ? 'danger'
                        : userBundle.storageSummary.percentUsed >= 75
                          ? 'warn'
                          : 'info'
                    }
                  />
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <p className="text-sm font-semibold">주의사항</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
              <li>GitHub password는 사용하지 말고 Personal Access Token만 사용하세요.</li>
              <li>token은 강한 보안 저장소가 아니라 브라우저 localStorage에 저장됩니다.</li>
              <li>공개 저장소 구조이므로 민감한 개인정보는 저장하지 않는 편이 좋습니다.</li>
              <li>Pages는 앱 배포용이고, 최신 데이터 조회는 raw GitHub 경로를 우선 사용합니다.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
