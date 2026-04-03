import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ROUTES } from '../constants/app'
import { useApp } from '../context/AppContext'
import { validatePassword, validateVehicleId } from '../lib/validation'
import { Badge, Button, Card, Field, Input, PageHero } from '../components/ui'

export const ActivateAccountPage = () => {
  const navigate = useNavigate()
  const { activateAccount, saveSettings, settings, allowedUsers } = useApp()
  const [vehicleId, setVehicleId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [token, setToken] = useState(settings.token)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const vehicleError = validateVehicleId(vehicleId)
    if (vehicleError) {
      setError(vehicleError)
      return
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (!token.trim()) {
      setError('회원가입에는 GitHub token이 필요합니다.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      saveSettings({ token: token.trim() })
      await activateAccount(vehicleId.trim(), password)
      navigate(ROUTES.home)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '회원가입에 실패했습니다.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const pendingEntries = allowedUsers.filter((entry) => entry.status === 'pending')

  return (
    <div className="min-h-screen bg-bg px-4 py-6 text-text lg:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHero
          title="허용된 차량번호만 계정 활성화"
          description="회원가입은 자유 가입이 아니라 사전 허용된 차량번호의 계정 활성화입니다. 최초 1회 비밀번호를 설정하면 `public/data/allowed_users.json`과 사용자 데이터 폴더가 GitHub에 생성됩니다."
        />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <h2 className="text-2xl font-semibold">계정 활성화</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              강보안 시스템이 아니므로, token은 브라우저 `localStorage`에 저장됩니다.
            </p>
            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <Field label="차량번호">
                <Input
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  placeholder="예: 68보0632"
                />
              </Field>
              <Field label="비밀번호">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8자 이상"
                />
              </Field>
              <Field label="비밀번호 확인">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
              <Field
                label="GitHub Token"
                hint="allowed_users.json과 사용자 JSON 폴더를 생성하기 위해 필요합니다."
              >
                <Input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="ghp_..."
                />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? '생성 중...' : '계정 활성화'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => navigate(ROUTES.login)}
                >
                  로그인으로 돌아가기
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-6">
            <Card>
              <p className="text-sm font-semibold">대기 중인 허용 차량번호</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {pendingEntries.length === 0 ? (
                  <Badge tone="success">모든 허용 차량 활성화 완료</Badge>
                ) : (
                  pendingEntries.map((entry) => (
                    <Badge key={entry.vehicleId} tone="warn">
                      {entry.vehicleId}
                    </Badge>
                  ))
                )}
              </div>
            </Card>
            <Card>
              <p className="text-sm font-semibold">관리자 작업 흐름</p>
              <ol className="mt-4 space-y-2 text-sm leading-6 text-muted">
                <li>1. `tools/allowed_vehicle_ids.txt`에 차량번호를 한 줄 추가</li>
                <li>2. `build_allowed_users.bat` 실행</li>
                <li>3. 생성된 `public/data/allowed_users.json` 커밋/푸시</li>
                <li>4. 사용자가 이 화면에서 최초 비밀번호를 설정</li>
              </ol>
              <Link
                to={ROUTES.login}
                className="mt-4 inline-flex text-sm font-medium text-accentSoft"
              >
                로그인 화면으로 이동
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
