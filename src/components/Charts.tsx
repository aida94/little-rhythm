import { describeEntry, feedMinutes, isMilk, isPoop, type DayStat } from '../lib/entries'
import { D, H, MIN, dayStart, hm, pad2 } from '../lib/time'
import type { Entry } from '../lib/types'

export type Layer = 'sleep' | 'eat' | 'poop' | 'wet'
export type Hidden = Partial<Record<Layer, boolean>>

const milkOrFood = (e: Entry) => `var(--chart-${isMilk(e.details) ? 'milk' : 'food'})`

/** One bar for today: sleep blocks, feeds, poop and pee marks, and a red "now" line. */
export function TodayStrip({ mine, now, onOpen }: { mine: Entry[]; now: number; onOpen: () => void }) {
  const a = dayStart(0)
  const W = 320
  const y0 = 4
  const h = 22
  const px = (t: number) => (W * (t - a)) / D
  return (
    <button className="strip card chart" onClick={onOpen} aria-label="Open the week overview in Trends">
      <span className="strip-h">
        <b>Today at a glance</b>
        <span>See week ›</span>
      </span>
      <svg viewBox={`0 0 ${W} 42`} role="img" aria-label="Today's sleep, eating and potty or diaper times">
        <rect x="0" y={y0} width={W} height={h} rx="6" fill="var(--track)" />
        {mine.map((e) => {
          if (e.type !== 'sleep') return null
          const st = Math.max(a, e.start)
          const en = Math.min(a + D, e.end || now)
          return en > st ? <rect key={e.id} x={px(st)} y={y0} width={Math.max(1.5, px(en) - px(st))} height={h} rx="3" fill="var(--chart-sleep)" /> : null
        })}
        {mine.map((e) => {
          if (e.start < a || e.start >= a + D) return null
          if (e.type === 'feed') {
            const m = feedMinutes(e)
            return m ? (
              <rect key={e.id} x={px(e.start)} y={y0} width={Math.max(2.5, px(e.start + m * MIN) - px(e.start))} height={h} rx="1.5" fill={milkOrFood(e)} />
            ) : (
              <rect key={e.id} x={px(e.start) - 1.25} y={y0} width="2.5" height={h} rx="0.75" fill={milkOrFood(e)} />
            )
          }
          if (e.type === 'diaper') {
            const p = isPoop(e.details)
            return <rect key={e.id} x={px(e.start) - (p ? 1.25 : 0.75)} y={y0} width={p ? 2.5 : 1.5} height={h} rx=".5" fill={`var(--${p ? 'poop' : 'wet'})`} />
          }
          return null
        })}
        <rect x={px(now) - 0.75} y={y0 - 2} width="1.5" height={h + 4} rx=".75" fill="var(--warn)" />
        {[0, 6, 12, 18, 24].map((t) => (
          <text key={t} x={px(a + t * H)} y="39" textAnchor={t === 0 ? 'start' : t === 24 ? 'end' : 'middle'}>
            {pad2(t % 24)}:00
          </text>
        ))}
      </svg>
    </button>
  )
}

/** 7 columns (days) × 24h: sleep blocks, milk blocks, meal lines, poop and pee lines. Overlaps are see-through. */
export function WeekChart({ mine, now, weekOff, hidden }: { mine: Entry[]; now: number; weekOff: number; hidden: Hidden }) {
  const W = 320
  const Hh = 380
  const pl = 36
  const pr = 2
  const pt = 30
  const pb = 4
  const cols = 7
  const gap = 4
  const cw = (W - pl - pr) / cols
  const ph = Hh - pt - pb
  const y = (ms: number) => pt + ph * (ms / D)

  const sleeps = hidden.sleep ? [] : mine.filter((e) => e.type === 'sleep')
  const busy = (st: number, en: number, self: Entry) =>
    sleeps.some((z) => z.start < en && (z.end || now) > st) ||
    (!hidden.eat && mine.some((z) => z !== self && z.type === 'feed' && feedMinutes(z) && z.start < en && z.start + feedMinutes(z) * MIN > st))
  const op = (st: number, en: number, self: Entry) => (busy(st, en, self) ? 0.5 : undefined)

  const columns = []
  const marks = []
  for (let i = 0; i < cols; i++) {
    const off = i - 6 + 7 * weekOff
    const a = dayStart(off)
    const b = a + D
    const x = pl + i * cw + gap / 2
    const w = cw - gap
    const dt = new Date(a)
    columns.push(
      <g key={'c' + i}>
        <text x={x + w / 2} y="11" textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 700, fontSize: 9.5 }}>
          {dt.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase().slice(0, 3)}
        </text>
        <text x={x + w / 2} y="23" textAnchor="middle" style={{ fill: off === 0 ? 'var(--ink)' : 'var(--muted)', fontWeight: off === 0 ? 700 : 500, fontSize: 9.5 }}>
          {pad2(dt.getDate())}/{pad2(dt.getMonth() + 1)}
        </text>
        <rect x={x} y={pt} width={w} height={ph} rx="7" fill="var(--track)" />
        {sleeps.map((e) => {
          const st = Math.max(a, e.start)
          const en = Math.min(b, e.end || now)
          if (en <= st) return null
          return (
            <rect key={e.id} x={x} y={y(st - a)} width={w} height={Math.max(1.5, y(en - a) - y(st - a))} rx="3" fill="var(--chart-sleep)">
              <title>{`${e.details.kind || 'Sleep'} ${hm(e.start)}–${e.end ? hm(e.end) : 'now'}`}</title>
            </rect>
          )
        })}
      </g>,
    )
    for (const e of mine) {
      if (e.start < a || e.start >= b) continue
      if (e.type === 'feed' && !hidden.eat) {
        const m = feedMinutes(e)
        const d = describeEntry(e, now)
        const t = `${d.what} ${hm(e.start)}${m ? ` · ${m} min` : ''}${d.det ? ` · ${d.det}` : ''}`
        const o = op(e.start, e.start + Math.max(m, 1) * MIN, e)
        marks.push(
          m ? (
            <rect key={e.id} x={x} y={y(e.start - a)} width={w} height={Math.max(3, y(m * MIN) - y(0))} rx="1.5" fill={milkOrFood(e)} fillOpacity={o}>
              <title>{t}</title>
            </rect>
          ) : (
            <rect key={e.id} x={x} y={y(e.start - a) - 1.5} width={w} height="3" rx="0.75" fill={milkOrFood(e)} fillOpacity={o}>
              <title>{t}</title>
            </rect>
          ),
        )
      } else if (e.type === 'diaper') {
        const poop = isPoop(e.details)
        if (hidden[poop ? 'poop' : 'wet']) continue
        marks.push(
          <rect
            key={e.id}
            x={x}
            y={y(e.start - a) - (poop ? 1.5 : 0.75)}
            width={w}
            height={poop ? 3 : 1.5}
            rx={poop ? 0.75 : 0.4}
            fill={`var(--${poop ? 'poop' : 'wet'})`}
            fillOpacity={op(e.start, e.start + MIN, e)}
          >
            <title>{`${poop ? 'Poop' : e.details.kind === 'Pee' ? 'Pee' : 'Wet diaper'}${e.details.accident ? ' (accident)' : ''} ${hm(e.start)}`}</title>
          </rect>,
        )
      }
    }
    if (off === 0 && now < b)
      marks.push(<line key="now" x1={x} x2={x + w} y1={y(now - a)} y2={y(now - a)} stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="3 2" strokeLinecap="round" />)
  }

  const grid = []
  for (let h = 2; h < 24; h += 2)
    grid.push(<line key={h} x1={pl} x2={W - pr} y1={y(h * H)} y2={y(h * H)} stroke="var(--surface)" strokeOpacity={h % 6 ? 0.6 : 0.85} strokeWidth={h % 6 ? 0.6 : 1} />)

  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Sleep, eating and diapers by time of day over 7 days">
      {columns}
      {marks}
      {grid}
      {[0, 6, 12, 18, 24].map((h) => (
        <text key={h} x={pl - 4} y={y(h * H) + (h === 0 ? 7 : h === 24 ? -1 : 3)} textAnchor="end" style={{ fontWeight: 600 }}>
          {pad2(h % 24)}:00
        </text>
      ))}
    </svg>
  )
}

/** Hours of sleep per day, last 7 days. */
export function SleepBars({ days }: { days: DayStat[] }) {
  const W = 320
  const Hh = 170
  const pl = 26
  const pb = 20
  const pt = 14
  const max = 16
  const bw = 26
  const step = (W - pl - 6) / 7
  const y = (v: number) => pt + (Hh - pt - pb) * (1 - v / max)
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Hours of sleep per day">
      {[0, 4, 8, 12, 16].map((t) => (
        <g key={t}>
          <line className="grid" x1={pl} x2={W} y1={y(t)} y2={y(t)} />
          <text x={pl - 6} y={y(t) + 3} textAnchor="end">
            {t}h
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = pl + i * step + (step - bw) / 2
        const v = Math.min(d.sleep, max)
        return (
          <g key={i}>
            <rect x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx="6" fill="var(--chart-sleep)" opacity={d.today ? 0.45 : 1} />
            <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 600 }}>
              {d.sleep.toFixed(1)}
            </text>
            <text x={x + bw / 2} y={Hh - 5} textAnchor="middle">
              {d.today ? 'Today' : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
