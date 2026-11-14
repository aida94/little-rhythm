import { AiError, chat } from './ai'
import { MEAL_TIMES } from './entries'
import { cleanEmoji } from './foodEmoji'
import { isPotty } from './kids'
import type { ParsedEntry } from './say'
import { MIN, pad2, uid } from './time'
import type { Details, KidInfo } from './types'

/**
 * "Say it" with AI: the AI reads a free sentence and returns log entries as JSON.
 * Kids' names are never sent. Each kid becomes "Child A", "Child B", … and the names are put back
 * locally in the answer. The app checks every entry before showing it.
 */

const LETTERS = 'ABCDEFGHIJ'
const label = (i: number) => `Child ${LETTERS[i] ?? i + 1}`

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replace each kid's name with its label ("Child A"), whole words only. */
export function hideNames(text: string, kids: KidInfo[]): string {
  let t = text
  kids.forEach((k, i) => {
    const name = k.name.trim()
    if (name) t = t.replace(new RegExp(`\\b${escape(name)}\\b`, 'gi'), label(i))
  })
  return t
}

/** Put the real names back in text that came from the AI. */
export function showNames(text: string, kids: KidInfo[]): string {
  let t = text
  kids.forEach((k, i) => {
    t = t.replace(new RegExp(`\\b${escape(label(i))}\\b`, 'g'), k.name)
  })
  return t
}

/** Local "YYYY-MM-DD HH:MM". */
export const localStamp = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Read "YYYY-MM-DD HH:MM" (or with a T) as local time. */
export function readStamp(s: unknown): number | null {
  if (typeof s !== 'string') return null
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  return new Date(y, mo - 1, d, h, mi).getTime()
}

const SYSTEM = `You turn a parent's short message about their children into baby-tracker log entries.
Children are called "Child A", "Child B" and so on. Never invent other names.
Rules:
- One entry per event. A message can hold several events, for several children.
- If the message does not say which child, use the default child.
- Times are local, written "YYYY-MM-DD HH:MM". Work them out from "now". Words like "this morning", "yesterday", "last night", "at 2", "2ish", "after lunch" are fine: pick the most likely time that is not in the future.
- If only a length is given ("slept 2 hours") and no time, assume it just ended now.
- sleep: give start, and end if the child woke up. Leave end null only if the child is still asleep. sleepKind is "Night" for night sleep or bedtime, otherwise "Nap".
- feed: method is "Breast", "Bottle", "Solids" (baby food, under 12 months) or "Food" (meals and snacks, 12 months and older). Fill ml and minutes when said. side is "Left", "Right" or "Both" for breastfeeding. food is what was eaten, short, in the parent's words. mealTime is "Breakfast", "Lunch", "Snack", "Dinner" or null. amount is "None", "A little", "Half", "Most" or "All" (default "Most"). emoji is 1 to 3 food or drink emoji for what was eaten, main food first.
- diaper: for wees, poos, diapers and potty. Set pee and poop. accident is true for a potty accident. For poo in a diaper you may add color (Yellow, Brown, Green, Black, Red, White) and texture (Runny, Soft, Firm, Hard) when said.
- note: anything else worth keeping (mood, health, teething, medicine, milestones). Put the text in note.
- said: the part of the message this entry came from.
Reply in json only.`

const EXAMPLE = `{"entries":[{"child":"Child A","type":"sleep","start":"2026-01-05 13:00","end":"2026-01-05 14:30","sleepKind":"Nap","said":"napped 1 to 2:30"},{"child":"Child B","type":"feed","start":"2026-01-05 12:15","method":"Food","food":"pasta with peas","mealTime":"Lunch","amount":"Half","emoji":"🍝🫛","said":"ate half her pasta for lunch"},{"child":"Child A","type":"diaper","start":"2026-01-05 10:00","pee":false,"poop":true,"said":"pooped at 10"},{"child":"Child B","type":"note","start":"2026-01-05 15:00","note":"Teething, a bit grumpy","said":"teething and grumpy"}]}`

function kidLine(k: KidInfo, i: number, current: KidInfo) {
  const g = k.gender === 'girl' ? 'girl' : k.gender === 'boy' ? 'boy' : 'child'
  const toilet = k.stage === 'Diaper' ? 'wears diapers' : k.stage === 'Training' ? 'is potty training' : 'uses the potty'
  return `- ${label(i)}: ${g}, ${k.ageM} months old, ${toilet}${k.id === current.id ? ' (default child)' : ''}`
}

const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback)
const num = (v: unknown) => (typeof v === 'number' && v > 0 && v < 10000 ? Math.round(v) : null)
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')

/** Check and convert the AI's answer into entries. Invalid items are skipped. */
export function readAiEntries(raw: string, kids: KidInfo[], current: KidInfo, now = Date.now()): ParsedEntry[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new AiError('format', 'The AI answer could not be read. Try again.')
  }
  const list = (data as { entries?: unknown })?.entries
  if (!Array.isArray(list)) throw new AiError('format', 'The AI answer could not be read. Try again.')

  const out: ParsedEntry[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const it = item as Record<string, unknown>
    const idx = typeof it.child === 'string' ? LETTERS.indexOf(it.child.replace(/^child\s*/i, '').trim().toUpperCase()) : -1
    const k = kids[idx] ?? current
    const type = pick(it.type, ['sleep', 'feed', 'diaper', 'note'] as const, 'note')
    let start = readStamp(it.start) ?? now
    if (start > now + 5 * MIN) start = now // never in the future
    const said = showNames(text(it.said), kids)
    const e: ParsedEntry = { id: uid(), kid: k.id, type, start, details: {}, said }

    if (type === 'sleep') {
      let end = readStamp(it.end)
      if (end !== null && end <= start) continue // impossible times: leave it out rather than guess
      if (end !== null && end > now + 5 * MIN) end = null // wakes in the future: still asleep
      e.end = end
      e.details = { kind: pick(it.sleepKind, ['Nap', 'Night'] as const, 'Nap') }
    } else if (type === 'feed') {
      const baby = k.ageM < 12
      const method = pick(it.method, ['Breast', 'Bottle', 'Solids', 'Food'] as const, baby ? 'Solids' : 'Food')
      const d: Details = {}
      if (method === 'Bottle') Object.assign(d, { method, ml: num(it.ml), minutes: num(it.minutes) })
      else if (method === 'Breast') Object.assign(d, { method, side: pick(it.side, ['Left', 'Right', 'Both'] as const, 'Both'), minutes: num(it.minutes) })
      else {
        const meal = pick(it.mealTime, [...MEAL_TIMES, ''] as const, '')
        const food = showNames(text(it.food), kids)
        Object.assign(d, {
          method: method === 'Food' ? 'Meal' : baby ? 'Solids' : 'Meal',
          food: (meal ? `${meal}${food ? ': ' + food : ''}` : food) || null,
          amount: pick(it.amount, ['None', 'A little', 'Half', 'Most', 'All'] as const, 'Most'),
        })
        const emoji = cleanEmoji(it.emoji)
        if (emoji && food) d.emoji = emoji
      }
      e.details = d
    } else if (type === 'diaper') {
      const poop = it.poop === true
      const pee = it.pee === true || !poop
      const potty = isPotty(k)
      const d: Details = { kind: poop && pee ? 'Both' : poop ? (potty ? 'Poop' : 'Dirty') : potty ? 'Pee' : 'Wet' }
      if (potty) {
        d.where = it.accident === true ? 'Accident' : 'In potty'
        if (it.accident === true) d.accident = true
      } else if (poop) {
        const color = pick(it.color, ['Yellow', 'Brown', 'Green', 'Black', 'Red', 'White', ''] as const, '')
        const texture = pick(it.texture, ['Runny', 'Soft', 'Firm', 'Hard', ''] as const, '')
        if (color) d.color = color
        if (texture) d.texture = texture
      }
      e.details = d
    } else {
      e.note = showNames(text(it.note) || text(it.said), kids)
      if (!e.note) continue
    }
    out.push(e)
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Ask the AI to read the message. Throws AiError when the AI cannot be used. */
export async function parseSayAi(message: string, kids: KidInfo[], current: KidInfo, now = Date.now()): Promise<ParsedEntry[]> {
  const day = new Date(now).toLocaleDateString('en-GB', { weekday: 'long' })
  const user = `Now: ${localStamp(now)} (${day})
Children:
${kids.map((k, i) => kidLine(k, i, current)).join('\n')}

Message: """${hideNames(message, kids)}"""

Reply in json only, in this format:
${EXAMPLE}`
  let result: ParsedEntry[] | undefined
  // JSON mode sometimes returns an empty answer; one retry covers it.
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      const raw = await chat(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
        { json: true, maxTokens: 1500 },
      )
      result = readAiEntries(raw, kids, current, now)
    } catch (e) {
      if (!(e instanceof AiError && e.kind === 'format') || attempt === 1) throw e
    }
  }
  return result!
}
