export const MIN = 60_000
export const H = 60 * MIN
export const D = 24 * H

/** Timestamp for a clock time on a day relative to today (0 = today, -1 = yesterday). */
export function at(dayOffset: number, h: number, m = 0): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dayOffset)
  return d.getTime() + h * H + m * MIN
}

export const dayStart = (offset: number) => at(offset, 0)

export const pad2 = (n: number) => String(n).padStart(2, '0')

/** 24-hour clock time, e.g. 07:05 */
export function hm(ts: number): string {
  const d = new Date(ts)
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

/** Duration, e.g. 3h 05m or 45m */
export function dur(ms: number): string {
  const m = Math.max(0, Math.round(ms / MIN))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${pad2(m % 60)}m` : `${m}m`
}

/** Local date as YYYY-MM-DD */
export function isoDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function monthsAgoIso(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return isoDate(d)
}

/** Turn an HH:MM field into a timestamp today, or yesterday if that time is still ahead. */
export function tsFromTime(hhmm: string, now = Date.now()): number {
  if (!hhmm) return now
  const [h, m] = hhmm.split(':').map(Number)
  let t = at(0, h, m)
  if (t > now + 5 * MIN) t -= D
  return t
}

export const uid = () => crypto.randomUUID()

/** Monday = 0 */
export const todayIdx = () => (new Date().getDay() + 6) % 7
