import { useRef, useState, type ReactNode } from 'react'

const BUTTON = 96 // width of the red Delete button
const FULL = 180 // swipe this far to delete straight away

/** Swipe a row left to show a Delete button; swipe far to delete at once.
 *  Taps still reach the row (for editing) unless the row was just swiped or is open. */
export function SwipeToDelete({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number; base: number; active: boolean } | null>(null)
  const swiped = useRef(false)
  const pos = useRef(0) // latest offset; state can lag behind fast pointer events
  const move = (x: number) => {
    pos.current = x
    setDx(x)
  }
  const close = () => move(0)

  return (
    <div className="swipe">
      <button
        className="swipe-del"
        tabIndex={dx ? 0 : -1}
        aria-hidden={!dx}
        style={{ visibility: dx || dragging ? 'visible' : 'hidden' }}
        onClick={onDelete}
      >
        Delete
      </button>
      <div
        className="swipe-fg"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform .2s ease-out' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, base: pos.current, active: false }
          swiped.current = false
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const mx = e.clientX - d.x
          const my = e.clientY - d.y
          if (!d.active) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) return void (drag.current = null) // scrolling
            if (Math.abs(mx) < 10) return
            d.active = true
            swiped.current = true
            setDragging(true)
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* some browsers refuse capture; the swipe still works */
            }
          }
          move(Math.min(0, Math.max(-FULL - 40, d.base + mx)))
        }}
        onPointerUp={() => {
          const d = drag.current
          drag.current = null
          if (!d?.active) return
          setDragging(false)
          const x = pos.current
          if (x <= -FULL) {
            move(0)
            onDelete()
          } else move(x < -BUTTON / 2 ? -BUTTON : 0)
        }}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
          move(pos.current < -BUTTON / 2 ? -BUTTON : 0)
        }}
        onClickCapture={(e) => {
          // A swipe is not a tap, and a tap on an open row just closes it.
          if (swiped.current || pos.current) {
            e.stopPropagation()
            e.preventDefault()
            swiped.current = false
            close()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
