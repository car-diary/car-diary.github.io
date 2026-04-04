import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Card, Field, Input } from '../components/ui'
import { ROUTES } from '../constants/app'
import { useApp } from '../context/appContextStore'
import { validateVehicleId } from '../lib/validation'

export const LoginPage = () => {
  const navigate = useNavigate()
  const { login, session } = useApp()
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
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-8 text-text">
      <div className="w-full max-w-md">
        <Card className="p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accentSoft">
            Car Diary
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">차량 로그인</h1>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Field label="차량번호" error={error}>
              <Input
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                autoComplete="off"
                autoFocus
              />
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? '접속 중...' : '들어가기'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
