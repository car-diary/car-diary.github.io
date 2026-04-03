import { Database, KeyRound, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { DEMO_PASSWORD, DEMO_VEHICLE_ID, ROUTES } from '../constants/app'
import { useApp } from '../context/AppContext'
import { validateVehicleId } from '../lib/validation'
import { Badge, Button, Card, Field, Input, PageHero } from '../components/ui'

export const LoginPage = () => {
  const navigate = useNavigate()
  const { login, settings, saveSettings, session, allowedUsers } = useApp()
  const [vehicleId, setVehicleId] = useState(DEMO_VEHICLE_ID)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [token, setToken] = useState(settings.token)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (session) {
      navigate(ROUTES.home)
    }
  }, [navigate, session])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const vehicleError = validateVehicleId(vehicleId)
    if (vehicleError) {
      setError(vehicleError)
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      saveSettings({ token: token.trim() })
      await login(vehicleId.trim(), password)
      navigate(ROUTES.home)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '로그인에 실패했습니다.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-6 text-text lg:px-6">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 lg:flex-row">
        <section className="flex-1">
          <PageHero
            title="차량 상태와 정비비 흐름을 GitHub 위에서 관리"
            description="Car Diary는 GitHub Pages 정적 사이트로 열리고, 실제 기록은 GitHub Repository JSON과 이미지에 저장됩니다. 로컬 PC가 꺼져 있어도 조회는 계속 가능하고, token을 넣으면 브라우저에서 직접 CRUD를 수행합니다."
            aside={
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="min-w-[180px]">
                  <ShieldAlert className="h-5 w-5 text-warn" />
                  <p className="mt-4 text-sm font-semibold">가벼운 인증</p>
                  <p className="mt-1 text-sm text-muted">
                    차량번호 + 비밀번호 기반 제한 로그인
                  </p>
                </Card>
                <Card className="min-w-[180px]">
                  <Database className="h-5 w-5 text-accentSoft" />
                  <p className="mt-4 text-sm font-semibold">GitHub JSON 저장</p>
                  <p className="mt-1 text-sm text-muted">
                    파일 구조가 보여서 초보자도 이해하기 쉽습니다.
                  </p>
                </Card>
                <Card className="min-w-[180px]">
                  <KeyRound className="h-5 w-5 text-success" />
                  <p className="mt-4 text-sm font-semibold">token 운영 모드</p>
                  <p className="mt-1 text-sm text-muted">
                    token이 없으면 읽기 전용으로 열립니다.
                  </p>
                </Card>
              </div>
            }
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <Card>
              <h2 className="text-2xl font-semibold">로그인</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                강보안 인증이 아니라, 사전 허용 차량번호와 비밀번호 해시를 이용한 가벼운 접근
                제한 UX입니다.
              </p>
              <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                <Field label="차량번호" error={error?.includes('차량번호') ? error : null}>
                  <Input
                    value={vehicleId}
                    onChange={(event) => setVehicleId(event.target.value)}
                    placeholder="예: 68보0632"
                  />
                </Field>
                <Field label="비밀번호" error={error?.includes('비밀번호') ? error : null}>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호 입력"
                  />
                </Field>
                <Field
                  label="GitHub Token"
                  hint="선택 입력입니다. 넣으면 쓰기 가능, 비우면 읽기 전용 모드입니다."
                >
                  <Input
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="ghp_..."
                  />
                </Field>
                {error && !error.includes('차량번호') && !error.includes('비밀번호') ? (
                  <p className="text-sm text-danger">{error}</p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? '로그인 중...' : '로그인'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => navigate(ROUTES.activate)}
                  >
                    회원가입 / 계정 활성화
                  </Button>
                </div>
              </form>
            </Card>

            <div className="space-y-6">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">샘플 계정</p>
                    <p className="mt-1 text-sm text-muted">초기 실행 확인용 더미 데이터</p>
                  </div>
                  <Badge tone="info">Demo</Badge>
                </div>
                <div className="mt-5 space-y-3 text-sm text-muted">
                  <p>차량번호: {DEMO_VEHICLE_ID}</p>
                  <p>비밀번호: {DEMO_PASSWORD}</p>
                  <p>이 계정은 샘플 `public/repository-data` JSON과 연결되어 있습니다.</p>
                </div>
              </Card>

              <Card>
                <p className="text-sm font-semibold">허용 차량번호 현황</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {allowedUsers.slice(0, 8).map((entry) => (
                    <Badge
                      key={entry.vehicleId}
                      tone={entry.status === 'activated' ? 'success' : 'warn'}
                    >
                      {entry.vehicleId}
                    </Badge>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted">
                  허용 차량번호는 로컬의 `tools/allowed_vehicle_ids.txt`를 편집한 뒤 빌드하여
                  생성합니다.
                </p>
              </Card>

              <Card>
                <p className="text-sm font-semibold">운영 메모</p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
                  <li>GitHub 비밀번호는 앱에서 쓰지 않습니다.</li>
                  <li>브라우저에는 Personal Access Token만 저장하세요.</li>
                  <li>토큰은 `Contents: Read and write` 권한만으로도 충분합니다.</li>
                </ul>
                <Link
                  to={ROUTES.activate}
                  className="mt-5 inline-flex text-sm font-medium text-accentSoft"
                >
                  새 차량번호 활성화하기
                </Link>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
