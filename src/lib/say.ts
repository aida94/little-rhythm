import { isPotty } from './kids'
import { D, H, MIN, dayStart, uid } from './time'
import type { Entry, KidInfo } from './types'

/**
 * "Say it": turn a sentence like "today Mila slept 3 hours from 1.00" into log entries.
 * Simple rules for now. Later this can be replaced by an AI model reading the sentence.
 */

export interface ParsedEntry extends Entry {
  said: string
}

function resolveHour(h: number, m: number, ampm: string | undefined, hint: string, dayOff: number, now: number): number {
  if (ampm === 'pm' && h < 12) h += 12
  else if (ampm === 'am' && h === 12) h = 0
  else if (!ampm && h <= 12) {
    if (/\b(morning|am)\b/.test(hint)) {
      if (h === 12) h = 0
    } else if (/\b(afternoon|evening|pm|tonight)\b/.test(hint)) {
      if (h < 12) h += 12
    } else if (/\b(night|bed|bedtime)\b/.test(hint) && h >= 6 && h < 12) h += 12
    else {
      // No hint: pick the latest of the two (AM or PM) that is not in the future.
      const base = dayStart(dayOff)
      const c = [h % 12, (h % 12) + 12].map((x) => base + x * H + m * MIN)
      const ok = c.filter((t) => dayOff < 0 || t <= now)
      return ok.length ? ok[ok.length - 1] : c[0]
    }
  }
  return dayStart(dayOff) + h * H + m * MIN
}

const TIME_RE = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?'

function grabTime(t: string, words: string, dayOff: number, now: number): number | null {
  const m = t.match(new RegExp('\\b(?:' + words + ')\\s+(?:about\\s+|around\\s+)?' + TIME_RE + '\\b'))
  if (!m) return null
  const h = +m[1]
  const mi = +(m[2] || 0)
  if (h > 24 || mi > 59) return null
  return resolveHour(h, mi, m[3], t, dayOff, now)
}

export function parseSay(text: string, kids: KidInfo[], current: KidInfo, now = Date.now()): ParsedEntry[] {
  const out: ParsedEntry[] = []
  let k = current
  // A full stop followed by a space ends a sentence; "1.00" or "1.5 hours" has no space, so it stays.
  const parts = text.split(/\n|;|\.\s+|\bthen\b|\band also\b/i)
  for (const raw of parts) {
    if (!raw || !raw.trim()) continue
    let t = ' ' + raw.toLowerCase().replace(/[!?]/g, ' ') + ' '
    k = kids.find((x) => x.name && t.includes(x.name.toLowerCase())) ?? k
    const dayOff = /\b(yesterday|last night)\b/.test(t) ? -1 : 0

    // How long
    let durMin = 0
    const dh = t.match(/(\d+(?:[.,]\d+)?|an|one|a)\s*(?:h|hr|hrs|hour|hours)\b/)
    const dm = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/)
    if (dh) {
      durMin += (/^(an|one|a)$/.test(dh[1]) ? 1 : parseFloat(dh[1].replace(',', '.'))) * 60
      t = t.replace(dh[0], ' ')
    }
    if (dm) {
      durMin += +dm[1]
      t = t.replace(dm[0], ' ')
    }
    if (/half an hour/.test(t)) durMin = durMin || 30
    if (/and a half/.test(t) && dh) durMin += 30
    const ml = t.match(/(\d+)\s*ml\b/)
    if (ml) t = t.replace(ml[0], ' ')

    // What kind of entry
    const type = /\b(poop|pooped|poo|pee|peed|wee|diaper|nappy|potty|wet|dirty)\b/.test(t)
      ? 'diaper'
      : /\b(sle+p\w*|slept|nap\w*|asleep)\b/.test(t)
        ? 'sleep'
        : ml || /\b(ate|eat|eaten|had|drank|drink|bottle|breast|breastfed|fed|feed|lunch|dinner|breakfast|snack|milk)\b/.test(t)
          ? 'feed'
          : 'note'

    // When
    let start = grabTime(t, 'from|at|since|around|about|by', dayOff, now)
    let end = grabTime(t, 'until|till|to|and woke at|woke up at|woke at', dayOff, now)
    const dms = durMin * MIN
    if (start && end && end <= start) end += D
    if (start && !end && dms) end = start + dms
    if (!start && end && dms) start = end - dms
    if (!start && !end && dms) {
      end = dayOff ? dayStart(dayOff) + 12 * H : now
      start = end - dms
    }
    if (!start) start = dayOff ? dayStart(dayOff) + 12 * H : now
    // A sleep with no length and an end still ahead is still running.
    if (end && end > now && type === 'sleep' && !dms) end = null

    const e: ParsedEntry = { id: uid(), kid: k.id, type, start, details: {}, said: raw.trim() }
    if (type === 'sleep') {
      e.end = end || null
      const hr = new Date(start).getHours()
      e.details.kind = /\bnight|bed/.test(t) || hr >= 19 || hr < 5 ? 'Night' : 'Nap'
    } else if (type === 'feed') {
      if (ml || /\bbottle\b/.test(t)) e.details = { method: 'Bottle', ml: ml ? +ml[1] : null, minutes: durMin || null }
      else if (/\bbreast/.test(t)) e.details = { method: 'Breast', side: /\bleft\b/.test(t) ? 'Left' : /\bright\b/.test(t) ? 'Right' : 'Both', minutes: durMin || null }
      else {
        const f = t.match(/\b(?:ate|eat|eaten|had|drank)\s+(?:some\s+|a\s+|an\s+)?(.+?)(?=\s+(?:at|from|for|around|about|this|today|yesterday)\b|\s*$)/)
        const meal = (t.match(/\b(breakfast|lunch|dinner|snack)\b/) || [])[1]
        let food = f ? f[1].trim() : ''
        if (meal && food === meal) food = ''
        if (meal) food = meal[0].toUpperCase() + meal.slice(1) + (food ? ': ' + food : '')
        e.details = {
          method: k.ageM < 12 ? 'Solids' : 'Meal',
          food: food || null,
          amount: /\ball\b|everything/.test(t) ? 'All' : /\blittle|few bites/.test(t) ? 'A little' : /\bhalf\b/.test(t) ? 'Half' : 'Most',
        }
      }
    } else if (type === 'diaper') {
      const poop = /\b(poop|pooped|poo|dirty)\b/.test(t)
      const pee = /\b(pee|peed|wee|wet)\b/.test(t)
      const pt = isPotty(k)
      e.details = { kind: poop && pee ? 'Both' : poop ? (pt ? 'Poop' : 'Dirty') : pt ? 'Pee' : 'Wet' }
      if (pt) {
        const acc = /\baccident\b/.test(t)
        e.details.where = acc ? 'Accident' : 'In potty'
        if (acc) e.details.accident = true
      }
    } else e.note = raw.trim()
    out.push(e)
  }
  return out
}
