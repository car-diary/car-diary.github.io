import { Suspense, lazy, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { ToastViewport } from './components/ui'
import { ROUTES } from './constants/app'
import { AppProvider, useApp } from './context/AppContext'

const BackupsPage = lazy(() =>
  import('./pages/BackupsPage').then((module) => ({
    default: module.BackupsPage,
  })),
)
const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({
    default: module.HomePage,
  })),
)
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
)
const MaintenanceRecordsPage = lazy(() =>
  import('./pages/MaintenanceRecordsPage').then((module) => ({
    default: module.MaintenanceRecordsPage,
  })),
)
const ScheduledMaintenancePage = lazy(() =>
  import('./pages/ScheduledMaintenancePage').then((module) => ({
    default: module.ScheduledMaintenancePage,
  })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)
const StatisticsPage = lazy(() =>
  import('./pages/StatisticsPage').then((module) => ({
    default: module.StatisticsPage,
  })),
)

const FullScreenState = ({ message }: { message: string }) => (
  <div className="grid min-h-screen place-items-center bg-bg px-4 text-text">
    <div className="rounded-3xl border border-border bg-panel px-6 py-5 shadow-panel">
      {message}
    </div>
  </div>
)

const RouteFallback = () => <FullScreenState message="화면을 준비하는 중입니다..." />

const PublicRoute = ({ children }: { children: ReactNode }) => {
  const { session, isBootstrapping } = useApp()
  if (isBootstrapping) return <FullScreenState message="데이터를 불러오는 중입니다..." />
  if (session) return <Navigate to={ROUTES.home} replace />
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

const ProtectedLayout = () => {
  const { session, isBootstrapping } = useApp()
  if (isBootstrapping) return <FullScreenState message="차량 데이터를 불러오는 중입니다..." />
  if (!session) return <Navigate to={ROUTES.login} replace />
  return <AppShell />
}

const AppRoutes = () => {
  const { toasts, dismissToast, session } = useApp()

  return (
    <HashRouter>
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <Routes>
        <Route
          path={ROUTES.login}
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route element={<ProtectedLayout />}>
          <Route
            path={ROUTES.home}
            element={
              <Suspense fallback={<RouteFallback />}>
                <HomePage />
              </Suspense>
            }
          />
          <Route
            path={ROUTES.records}
            element={
              <Suspense fallback={<RouteFallback />}>
                <MaintenanceRecordsPage />
              </Suspense>
            }
          />
          <Route
            path={ROUTES.scheduled}
            element={
              <Suspense fallback={<RouteFallback />}>
                <ScheduledMaintenancePage />
              </Suspense>
            }
          />
          <Route
            path={ROUTES.statistics}
            element={
              <Suspense fallback={<RouteFallback />}>
                <StatisticsPage />
              </Suspense>
            }
          />
          <Route
            path={ROUTES.backups}
            element={
              <Suspense fallback={<RouteFallback />}>
                <BackupsPage />
              </Suspense>
            }
          />
          <Route
            path={ROUTES.settings}
            element={
              <Suspense fallback={<RouteFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="*"
          element={<Navigate to={session ? ROUTES.home : ROUTES.login} replace />}
        />
      </Routes>
    </HashRouter>
  )
}

const App = () => (
  <AppProvider>
    <AppRoutes />
  </AppProvider>
)

export default App
