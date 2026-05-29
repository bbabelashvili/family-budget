import type { ReactNode } from 'react'

interface WidgetProps {
  title: string
  icon?: ReactNode
  action?: ReactNode
  dragHandle?: ReactNode
  children: ReactNode
  className?: string
}

export function Widget({ title, icon, action, dragHandle, children, className = '' }: WidgetProps) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          {icon && <span className="opacity-70">{icon}</span>}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          {dragHandle}
        </div>
      </div>
      {children}
    </div>
  )
}
