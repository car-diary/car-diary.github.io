import { useEffect, useState } from 'react'

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

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const handleSave = () => {
    saveSettings(draft)
    setStatus('저장소 설정을 업데이트했습니다.')
  }

  const handleTest = async () => {
    setIsTesting(true)
    setStatus(null)
    try {
      saveSettings(draft)
      await testGitHubConnection()
      await refreshAllowedUsers()
      setStatus('저장소 연결과 허용 차량 목록을 다시 확인했습니다.')
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : '저장소 연결 확인에 실패했습니다.',
      )
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="운영 설정"
        description="저장소 경로와 데이터 위치를 확인하고, 현재 빌드의 동기화 상태를 점검합니다."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <SectionTitle
            title="저장소 경로"
            description="GitHub Pages 배포 주소와 실제 데이터 저장 경로를 같은 저장소 기준으로 관리합니다."
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
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSave}>설정 저장</Button>
            <Button variant="secondary" onClick={handleTest} disabled={isTesting}>
              {isTesting ? '연결 확인 중...' : '저장소 연결 확인'}
            </Button>
          </div>
          {status ? <p className="mt-4 text-sm text-muted">{status}</p> : null}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle
              title="동기화 상태"
              description="현재 실행 중인 빌드가 기록 저장까지 가능한지 확인합니다."
            />
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm text-text">현재 상태</span>
              <Badge tone={isReadOnly ? 'warn' : 'success'}>
                {isReadOnly ? '조회 전용' : '저장 연결됨'}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              {isReadOnly
                ? '현재 환경은 공개 데이터 조회 중심으로 동작합니다.'
                : '정비내역, 정비예정, 주행거리, 첨부 파일까지 바로 저장할 수 있습니다.'}
            </p>
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
            <p className="text-sm font-semibold">운영 메모</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
              <li>허용 차량 목록은 `tools/allowed_vehicle_ids.txt`를 수정한 뒤 다시 빌드합니다.</li>
              <li>사이트는 정적으로 배포되지만, 실제 차량 데이터는 저장소 JSON과 이미지 파일에 기록됩니다.</li>
              <li>공개 저장소 구조이므로 민감한 개인정보나 강한 보안이 필요한 데이터는 올리지 않는 편이 안전합니다.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
