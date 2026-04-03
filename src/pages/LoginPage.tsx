import { CarFront, Database, Gauge, LayoutGrid } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge, Button, Card, Field, Input, PageHero } from '../components/ui'
import { ROUTES } from '../constants/app'
import { useApp } from '../context/AppContext'
import { validateVehicleId } from '../lib/validation'

export const LoginPage = () => {
  const navigate = useNavigate()
  const { login, session, allowedUsers } = useApp()
  const [vehicleId, setVehicleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (session) {
      navigate(ROUTES.home)
    }
  }, [navigate, session])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextVehicleId = vehicleId.trim()
    const vehicleError = validateVehicleId(nextVehicleId)
    if (vehicleError) {
      setError(vehicleError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await login(nextVehicleId)
      navigate(ROUTES.home)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '로그인 처리에 실패했습니다.',
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
            title="차량별 정비 기록과 유지비를 한 화면에서 관리"
            description="Car Diary는 GitHub Pages에 배포되는 차량 정비/차계부 웹앱입니다. 허용된 차량번호만 접속할 수 있고, 기록은 저장소 데이터와 바로 연결됩니다."
            aside={
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="min-w-[180px]">
                  <CarFront className="h-5 w-5 text-accentSoft" />
                  <p className="mt-4 text-sm font-semibold">차량번호 바로 접속</p>
                  <p className="mt-1 text-sm text-muted">
                    허용된 차량번호만 입력하면 바로 기록 화면으로 들어갑니다.
                  </p>
                </Card>
                <Card className="min-w-[180px]">
                  <Database className="h-5 w-5 text-success" />
                  <p className="mt-4 text-sm font-semibold">저장소 동기화</p>
                  <p className="mt-1 text-sm text-muted">
                    정비내역, 정비예정, 사진, 영수증을 GitHub 데이터와 함께 관리합니다.
                  </p>
                </Card>
                <Card className="min-w-[180px]">
                  <LayoutGrid className="h-5 w-5 text-warn" />
                  <p className="mt-4 text-sm font-semibold">모든 화면 반응형</p>
                  <p className="mt-1 text-sm text-muted">
                    모바일, 태블릿, 데스크탑에서 같은 흐름으로 바로 사용할 수 있습니다.
                  </p>
                </Card>
              </div>
            }
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <h2 className="text-2xl font-semibold">차량 로그인</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                차량번호를 입력하면 해당 차량의 정비 기록, 예정 정비, 사진, 통계를 바로 불러옵니다.
              </p>
              <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                <Field label="차량번호" error={error?.includes('차량번호') ? error : null}>
                  <Input
                    value={vehicleId}
                    onChange={(event) => setVehicleId(event.target.value)}
                    placeholder="예: 68보0632"
                    autoComplete="off"
                  />
                </Field>
                {error && !error.includes('차량번호') ? (
                  <p className="text-sm text-danger">{error}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? '접속 중...' : '차량 열기'}
                </Button>
              </form>
            </Card>

            <div className="space-y-6">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">허용 차량 목록</p>
                    <p className="mt-1 text-sm text-muted">
                      현재 접속 가능한 차량번호 목록입니다.
                    </p>
                  </div>
                  <Badge tone="info">{allowedUsers.length}대</Badge>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {allowedUsers.length === 0 ? (
                    <Badge tone="warn">허용 차량 정보를 불러오는 중입니다.</Badge>
                  ) : (
                    allowedUsers.slice(0, 8).map((entry) => (
                      <Badge key={entry.vehicleId} tone="success">
                        {entry.vehicleId}
                      </Badge>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-3">
                  <Gauge className="h-5 w-5 text-accentSoft" />
                  <p className="text-sm font-semibold">운영 포인트</p>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
                  <li>홈 화면에서 현재 주행거리, 예정 정비, 최근 지출을 한 번에 확인합니다.</li>
                  <li>정비내역과 정비예정은 차량별 JSON 문서로 정리되어 GitHub에 저장됩니다.</li>
                  <li>사진과 영수증은 자동 압축 후 업로드되며 저장공간 사용량도 함께 계산됩니다.</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
