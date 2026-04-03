import {
  BarChart3,
  CalendarClock,
  Gauge,
  HardDriveDownload,
  LogOut,
  Menu,
  Settings,
  Wrench,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { ROUTES } from '../../constants/app'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'
import { Badge, Button, Card, IconButton, LoadingOverlay } from '../ui'

const navItems = [
  { to: ROUTES.home, label: '홈', icon: Gauge },
  { to: ROUTES.records, label: '정비내역', icon: Wrench },
  { to: ROUTES.scheduled, label: '정비예정', icon: CalendarClock },
  { to: ROUTES.statistics, label: '통계', icon: BarChart3 },
  { to: ROUTES.backups, label: '백업', icon: HardDriveDownload },
  { to: ROUTES.settings, label: '설정', icon: Settings },
]

export const AppShell = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { userBundle, session, logout, isReadOnly, isSaving } = useApp()
  const nickname = userBundle?.profile.nickname || session?.vehicleId || '차량'
  const routeTitle =
    navItems.find((item) => item.to === location.pathname)?.label ?? 'Car Diary'

  return (
    <div className="min-h-screen bg-bg text-text">
      <LoadingOverlay visible={isSaving} />
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <Card className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accentSoft">
                Car Diary
              </p>
              <h1 className="mt-3 text-2xl font-semibold">{nickname}</h1>
              <p className="mt-2 text-sm text-muted">
                정비 기록, 예정 정비, 지출, 사진을 차량별로 정리합니다.
              </p>
            </div>
            <nav className="space-y-2">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                      isActive
                        ? 'bg-accent text-slate-950'
                        : 'text-muted hover:bg-panelAlt hover:text-text',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto space-y-4">
              <div className="rounded-2xl border border-border bg-panelAlt p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">
                  Repository Sync
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text">
                    {isReadOnly ? '조회 중심 실행' : '저장 연결됨'}
                  </span>
                  <Badge tone={isReadOnly ? 'warn' : 'success'}>
                    {isReadOnly ? '조회 전용' : '실시간 저장'}
                  </Badge>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full justify-between"
                onClick={() => {
                  logout()
                  navigate(ROUTES.login)
                }}
              >
                로그아웃
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="space-y-6">
            <Card className="flex items-center justify-between gap-4 lg:hidden">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Current</p>
                <h2 className="mt-2 text-xl font-semibold">{routeTitle}</h2>
              </div>
              <IconButton
                icon={Menu}
                label="설정으로 이동"
                onClick={() => navigate(ROUTES.settings)}
              />
            </Card>
            <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-gradient-to-r from-panel to-panelAlt px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted">로그인 차량</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">{session?.vehicleId}</h2>
                  <Badge tone={isReadOnly ? 'warn' : 'success'}>
                    {isReadOnly ? '조회 전용' : '기록 저장 가능'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => navigate(ROUTES.settings)}>
                  설정
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    logout()
                    navigate(ROUTES.login)
                  }}
                >
                  로그아웃
                </Button>
              </div>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
