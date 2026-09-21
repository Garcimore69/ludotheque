import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Chip({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) {
  return (
    <button type="button" className={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={onClick}>
      {children}
      {count != null && <span className="chip-count">{count}</span>}
    </button>
  )
}

export function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  label: string
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Moins" onClick={() => onChange(value == null || value <= min ? null : value - 1)}>
        −
      </button>
      <span className="stepper-val">{value ?? 'Tous'}</span>
      <button type="button" aria-label="Plus" onClick={() => onChange(Math.min(max, (value ?? min - 1) + 1))}>
        +
      </button>
    </div>
  )
}

export function Section({ title, hint, children, collapsible = false, open = true }: { title: string; hint?: string; children: ReactNode; collapsible?: boolean; open?: boolean }) {
  if (collapsible) {
    return (
      <details className="fsec" open={open}>
        <summary>
          <span>
            <span className="fsec-title">{title}</span>
            {hint && <span className="fsec-hint">{hint}</span>}
          </span>
          <Icon name="chevron" />
        </summary>
        <div className="fsec-body">{children}</div>
      </details>
    )
  }
  return (
    <section className="fsec">
      <div className="fsec-head">
        <span className="fsec-title">{title}</span>
        {hint && <span className="fsec-hint">{hint}</span>}
      </div>
      <div className="fsec-body">{children}</div>
    </section>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.title} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
