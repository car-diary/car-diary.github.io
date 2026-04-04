import { LoaderCircle, X, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { cn } from '../lib/utils'
import type { ToastMessage } from '../types/models'

export const Card = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'rounded-3xl border border-border/90 bg-panel/85 p-5 shadow-panel backdrop-blur',
      className,
    )}
    {...props}
  />
)

export const SectionTitle = ({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) => (
  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-text">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
    {action}
  </div>
)

export const Button = ({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  loadingLabel?: ReactNode
}) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
      variant === 'primary' &&
        'bg-accent px-4 text-slate-950 hover:bg-accentSoft',
      variant === 'secondary' &&
        'border border-border bg-panelAlt px-4 text-text hover:border-accent/60 hover:text-accentSoft',
      variant === 'ghost' && 'px-3 text-muted hover:bg-panelAlt hover:text-text',
      variant === 'danger' &&
        'border border-danger/40 bg-danger/10 px-4 text-danger hover:bg-danger/20',
      size === 'sm' ? 'h-9 text-sm' : 'h-11 text-sm',
      className,
    )}
    aria-busy={loading || undefined}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <Spinner className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
    {loading && loadingLabel ? loadingLabel : children}
  </button>
)

export const IconButton = ({
  icon: Icon,
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
}) => (
  <button
    aria-label={label}
    className={cn(
      'inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-panelAlt text-muted transition hover:text-text',
      className,
    )}
    {...props}
  >
    <Icon className="h-4 w-4" />
  </button>
)

export const Badge = ({
  className,
  tone = 'neutral',
  children,
}: {
  className?: string
  tone?: 'neutral' | 'info' | 'warn' | 'danger' | 'success'
  children: ReactNode
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
      tone === 'neutral' && 'bg-panelAlt text-muted',
      tone === 'info' && 'bg-accent/15 text-accentSoft',
      tone === 'warn' && 'bg-warn/15 text-warn',
      tone === 'danger' && 'bg-danger/15 text-danger',
      tone === 'success' && 'bg-success/15 text-success',
      className,
    )}
  >
    {children}
  </span>
)

export const Input = ({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'h-11 w-full rounded-2xl border border-border bg-panelAlt px-4 text-sm text-text outline-none transition placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/25',
      className,
    )}
    {...props}
  />
)

export const TextArea = ({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      'min-h-[120px] w-full rounded-2xl border border-border bg-panelAlt px-4 py-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/25',
      className,
    )}
    {...props}
  />
)

export const Select = ({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      'h-11 w-full rounded-2xl border border-border bg-panelAlt px-4 text-sm text-text outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/25',
      className,
    )}
    {...props}
  />
)

export const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-medium text-text">{label}</span>
    {children}
    {error ? (
      <span className="text-xs text-danger">{error}</span>
    ) : hint ? (
      <span className="text-xs text-muted">{hint}</span>
    ) : null}
  </label>
)

export const ProgressBar = ({
  value,
  tone = 'info',
}: {
  value: number
  tone?: 'info' | 'warn' | 'danger'
}) => (
  <div className="h-2.5 overflow-hidden rounded-full bg-panelAlt">
    <div
      className={cn(
        'h-full rounded-full transition-all',
        tone === 'info' && 'bg-accent',
        tone === 'warn' && 'bg-warn',
        tone === 'danger' && 'bg-danger',
      )}
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
    />
  </div>
)

export const Spinner = ({ className }: { className?: string }) => (
  <LoaderCircle className={cn('h-4 w-4 animate-spin', className)} />
)

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) => (
  <Card className="border-dashed bg-panel/50 text-center">
    <p className="text-lg font-semibold text-text">{title}</p>
    <p className="mt-2 text-sm text-muted">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </Card>
)

export const Modal = ({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-panel p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <IconButton icon={X} label="닫기" onClick={onClose} />
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

export const LoadingOverlay = ({ visible }: { visible: boolean }) =>
  visible ? (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-panel/92 px-4 py-2 text-sm text-text shadow-panel backdrop-blur-md">
        <Spinner className="h-4 w-4 text-accentSoft" />
        처리 중
      </div>
    </div>
  ) : null

export const ToastViewport = ({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[]
  onDismiss: (toastId: string) => void
}) => (
  <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={cn(
          'pointer-events-auto rounded-3xl border p-4 shadow-panel',
          toast.tone === 'success' && 'border-success/40 bg-success/10',
          toast.tone === 'error' && 'border-danger/40 bg-danger/10',
          toast.tone === 'info' && 'border-accent/40 bg-panel',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-text">{toast.title}</p>
            {toast.description ? (
              <p className="mt-1 text-sm text-muted">{toast.description}</p>
            ) : null}
          </div>
          <button
            className="text-muted transition hover:text-text"
            onClick={() => onDismiss(toast.id)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    ))}
  </div>
)
