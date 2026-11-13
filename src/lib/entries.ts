import { D, H, MIN, dayStart, dur, hm, tsFromTime, tsOnDay } from './time'
import type { Details, Entry, EntryType } from './types'

export const isPoop = (d?: Details) => ['Dirty', 'Poop', 'Both'].includes(d?.kind ?? '')
export const isMilk = (d: Details) => d.method === 'Bottle' || d.method === 'Breast'

/** Minutes a feed lasted. Bottles without a time count as 15; meals are a moment. */
export function feedMinutes(e: Entry): number {
  const d = e.details
  if (d.minutes) return +d.minutes
  return d.method === 'Bottle' ? 15 : 0
}

export function describeEntry(e: Entry, now = Date.now()): { what: string; det: string } {
  const d = e.details ?? {}
  if (e.type === 'sleep')
    return {
      what: (d.kind || 'Sleep') + (e.end ? '' : ' · sleeping now'),
      det: e.end ? `${hm(e.start)} – ${hm(e.end)} · ${dur(e.end - e.start)}` : `Started ${hm(e.start)} · ${dur(now - e.start)}`,
    }
  if (e.type === 'feed') {
    if (d.method === 'Bottle') return { what: 'Bottle', det: [`${d.ml || '?'} ml`, d.minutes ? `${d.minutes} min` : ''].filter(Boolean).join(' · ') }
    if (d.method === 'Breast') return { what: 'Breastfeed', det: [d.side, d.minutes ? `${d.minutes} min` : ''].filter(Boolean).join(' · ') }
    return { what: d.method === 'Meal' ? 'Meal' : 'Solids', det: [d.food, d.amount && `${d.amount} eaten`].filter(Boolean).join(' · ') }
  }
  if (e.type === 'diaper') {
    const potty = ['Pee', 'Poop'].includes(d.kind ?? '') || !!d.where
    return {
      what: (potty ? 'Potty · ' : 'Diaper · ') + (d.kind || '') + (d.accident ? ' · accident' : ''),
      det: [d.color, d.texture, d.where && d.where !== 'In potty' && !d.accident ? d.where : ''].filter(Boolean).join(', '),
    }
  }
  return { what: 'Note', det: '' }
}

export const runningSleep = (mine: Entry[]) => mine.find((e) => e.type === 'sleep' && !e.end)

export function lastOf(mine: Entry[], type: EntryType): Entry | undefined {
  let best: Entry | undefined
  for (const e of mine) if (e.type === type && (!best || e.start > best.start)) best = e
  return best
}

export function lastFinishedSleep(mine: Entry[]): Entry | undefined {
  let best: Entry | undefined
  for (const e of mine) if (e.type === 'sleep' && e.end && (!best || e.end > best.end!)) best = e
  return best
}

/** Milliseconds asleep between a and b. */
export function sleepIn(mine: Entry[], a: number, b: number, now = Date.now()): number {
  let s = 0
  for (const e of mine) {
    if (e.type !== 'sleep') continue
    const st = Math.max(a, e.start)
    const en = Math.min(b, e.end || now)
    s += Math.max(0, en - st)
  }
  return s
}

export interface DayStat {
  label: string
  sleep: number // hours
  feeds: number
  diapers: number
  today: boolean
}

/** The last 7 days, oldest first, today last. */
export function weekStats(mine: Entry[], now = Date.now()): DayStat[] {
  const days: DayStat[] = []
  for (let i = -6; i <= 0; i++) {
    const a = dayStart(i)
    const b = a + D
    const es = mine.filter((e) => e.start >= a && e.start < b)
    days.push({
      label: new Date(a).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      sleep: sleepIn(mine, a, b, now) / H,
      feeds: es.filter((e) => e.type === 'feed').length,
      diapers: es.filter((e) => e.type === 'diaper').length,
      today: i === 0,
    })
  }
  return days
}

/** Average night-sleep start over the last week, and how much it moves (standard deviation, minutes). */
export function bedtime(mine: Entry[]): { avg?: string; spread?: number } {
  const n = mine
    .filter((e) => e.type === 'sleep' && e.details?.kind === 'Night' && e.start > dayStart(-7))
    .map((e) => {
      const d = new Date(e.start)
      let m = d.getHours() * 60 + d.getMinutes()
      if (m < 12 * 60) m += 1440
      return m
    })
  if (!n.length) return {}
  const mean = n.reduce((a, b) => a + b, 0) / n.length
  const sd = Math.sqrt(n.reduce((a, b) => a + (b - mean) ** 2, 0) / n.length)
  const mm = Math.round(mean) % 1440
  return { avg: `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`, spread: Math.round(sd) }
}

export function weekLabel(weekOff: number): string {
  const b = 7 * weekOff
  const f = (o: number) => new Date(dayStart(o)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return weekOff === 0 ? 'Last 7 days' : `${f(b - 6)} – ${f(b)}`
}

/** "Avg sleep 11h 32m / day" over the full days in the window that have sleep logged. */
export function weekSummary(mine: Entry[], weekOff: number, now = Date.now()): string {
  const b = 7 * weekOff
  const days: number[] = []
  for (let o = b - 6; o <= b; o++) {
    if (o === 0) continue
    const a = dayStart(o)
    const v = sleepIn(mine, a, a + D, now)
    if (v) days.push(v)
  }
  if (!days.length) return b === 0 && sleepIn(mine, dayStart(0), now, now) ? 'Average shows after a full day' : 'No sleep logged'
  return `Avg sleep ${dur(days.reduce((t, v) => t + v, 0) / days.length)} / day`
}


/** Turn the sleep sheet's times into timestamps and check them against the child's other sleeps.
 *  endHm null means the child is still asleep. Returns an error message instead when something is off. */
export function planSleep(
  startHm: string,
  endHm: string | null,
  others: Entry[],
  now = Date.now(),
  /** When editing: the entry's original start, so the sleep stays on its own day. */
  ref?: number,
): { start: number; end: number | null } | { error: string } {
  if (!startHm) return { error: 'Add the time the child fell asleep.' }
  let start = ref === undefined ? tsFromTime(startHm, now) : tsOnDay(startHm, ref, now)
  let end: number | null = null
  if (endHm !== null) {
    if (!endHm) return { error: 'Add the time the child woke up.' }
    if (endHm === startHm) return { error: 'Fell asleep and woke up are the same time. Change one of them.' }
    if (ref === undefined) {
      end = tsFromTime(endHm, now)
      if (end <= start) start -= D
    } else {
      end = tsOnDay(endHm, start, Infinity)
      if (end <= start) end += D
      if (end > now + 5 * MIN) return { error: 'The woke up time is in the future. Check the times.' }
    }
    if (end - start > 16 * H) return { error: 'That sleep is longer than 16 hours. Check the times.' }
  }
  const sleeps = others.filter((e) => e.type === 'sleep')
  if (end === null) {
    const run = sleeps.find((e) => !e.end)
    if (run) return { error: `A sleep is already running since ${hm(run.start)}. Use Wake up first.` }
  }
  const myEnd = end ?? now
  const clash = sleeps.find((e) => start < (e.end ?? now) && e.start < myEnd)
  if (clash) return { error: `This overlaps the sleep ${hm(clash.start)}–${clash.end ? hm(clash.end) : 'now'}. Check the times.` }
  return { start, end }
}
