import { useEffect, useRef, type ReactNode } from 'react'

type ChipOption = string | [label: string, swatch: string]

/** A row of choice buttons; one is selected. */
export function ChipRow({ options, value, onChange }: { options: ChipOption[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const v = Array.isArray(o) ? o[0] : o
        return (
          <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>
            {Array.isArray(o) && <span className="swatch" style={{ background: o[1] }} />}
            {v}
          </button>
        )
      })}
    </div>
  )
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="field">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
      {children}
    </div>
  )
}

/** Bottom sheet with a dimmed background. Closes on tap outside or Escape. */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" ref={ref}>
        <div className="grab" />
        {children}
      </div>
    </>
  )
}
