import { AiError, chat } from './ai'
import { getSetting, setSetting } from './db'
import { isPoop } from './entries'
import { isPotty } from './kids'
import { D, dayStart, dur, hm } from './time'
import type { Entry, KidInfo } from './types'

/**
 * What is sent to the AI: a compact text summary of one child's last days.
 * Names are never sent. The child's own name becomes "the child", other kids' names become "a sibling".
 */
export function scrubNames(text: string, kid: KidInfo, allKids: KidInfo[], self = 'the child'): string {
  let t = text
  for (const k of allKids) {
    const name = k.name.trim()
    if (!name) continue
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    t = t.replace(re, k.id === kid.id ? self : 'a sibling')
  }
  return t.replace(/\s+/g, ' ').trim()
}

export function childSummary(kid: KidInfo, mine: Entry[], allKids: KidInfo[], days = 14, now = Date.now()): string {
  const scrub = (text: string) => scrubNames(text, kid, allKids)
  const gender = kid.gender === 'girl' ? 'girl' : kid.gender === 'boy' ? 'boy' : 'child'
  const toilet = kid.stage === 'Diaper' ? 'wears diapers' : kid.stage === 'Training' ? 'is potty training' : 'uses the potty'
  const lines = [`Child: ${gender}, ${kid.ageM} months old, ${toilet}.`]

  for (let o = -(days - 1); o <= 0; o++) {
    const a = dayStart(o)
    const b = a + D
    const es = mine.filter((e) => e.start >= a && e.start < b).sort((x, y) => x.start - y.start)
    const label = new Date(a).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (!es.length) {
      lines.push(`${label}${o === 0 ? ' (today, so far)' : ''}: nothing logged`)
      continue
    }
    lines.push(`${label}${o === 0 ? ` (today, until ${hm(now)})` : ''}:`)
    const sleeps = es.filter((e) => e.type === 'sleep')
    if (sleeps.length)
      lines.push(
        '  Sleep: ' +
          sleeps.map((e) => `${(e.details.kind || 'sleep').toLowerCase()} ${hm(e.start)}–${e.end ? `${hm(e.end)} (${dur(e.end - e.start)})` : 'still asleep'}`).join('; '),
      )
    const feeds = es.filter((e) => e.type === 'feed')
    if (feeds.length)
      lines.push(
        '  Eating: ' +
          feeds
            .map((e) => {
              const d = e.details
              if (d.method === 'Bottle') return `${hm(e.start)} bottle ${d.ml ? d.ml + ' ml' : ''}${d.minutes ? ` ${d.minutes} min` : ''}`.trim()
              if (d.method === 'Breast') return `${hm(e.start)} breastfeed ${d.side ?? ''}${d.minutes ? ` ${d.minutes} min` : ''}`.trim()
              return `${hm(e.start)} ${scrub(d.food || (d.method === 'Solids' ? 'solids' : 'meal'))}${d.amount ? ` (${d.amount.toLowerCase()} eaten)` : ''}`
            })
            .join('; '),
      )
    const toiletEs = es.filter((e) => e.type === 'diaper')
    if (toiletEs.length) {
      const poops = toiletEs.filter((e) => isPoop(e.details))
      const acc = toiletEs.filter((e) => e.details.accident).length
      const poopInfo = poops.map((e) => `${hm(e.start)}${e.details.color ? ` ${e.details.color.toLowerCase()}` : ''}${e.details.texture ? ` ${e.details.texture.toLowerCase()}` : ''}`).join(', ')
      lines.push(`  ${isPotty(kid) ? 'Potty' : 'Diapers'}: ${toiletEs.length} total${poops.length ? `, poop at ${poopInfo}` : ', no poop'}${acc ? `, ${acc} accident${acc > 1 ? 's' : ''}` : ''}`)
    }
    const notes = es.filter((e) => e.note)
    if (notes.length) lines.push('  Notes: ' + notes.map((e) => `${hm(e.start)} "${scrub(e.note!)}"`).join('; '))
  }
  return lines.join('\n')
}

const SYSTEM = `You help a parent understand a young child's sleep, eating and potty patterns from the parent's own logs.
Be warm, short and practical. Base everything on the logs; do not invent events. Days with "nothing logged" may simply not have been tracked.
Give general, age-appropriate guidance, not a diagnosis. If something in the logs could be a health concern (for example blood or black or white stool, fever, signs of dehydration, a big drop in eating or sleep), say clearly to check with a pediatrician.
Use plain, simple English. Say "your child" rather than a name.`

export interface AiInsight {
  area: 'sleep' | 'food' | 'potty' | 'general'
  title: string
  detail: string
  try?: string
}
export interface AiInsightResult {
  summary: string
  insights: AiInsight[]
  seeDoctor?: string | null
}
export interface SavedInsights {
  createdAt: number
  result: AiInsightResult
}

const EXAMPLE = `{
  "summary": "One or two sentences about the week.",
  "insights": [
    { "area": "sleep", "title": "Short headline", "detail": "What the logs show, with numbers.", "try": "One small thing to try this week." }
  ],
  "see_doctor": null
}`

/** Parse and check the AI's JSON. Anything malformed is dropped rather than shown. */
export function parseInsights(text: string): AiInsightResult {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    throw new AiError('format', 'The AI answer could not be read. Try again.')
  }
  const o = v as Record<string, unknown>
  const areas = ['sleep', 'food', 'potty', 'general']
  const insights = (Array.isArray(o.insights) ? o.insights : [])
    .map((i) => i as Record<string, unknown>)
    .filter((i) => typeof i.title === 'string' && typeof i.detail === 'string')
    .map((i) => ({
      area: (areas.includes(i.area as string) ? i.area : 'general') as AiInsight['area'],
      title: String(i.title),
      detail: String(i.detail),
      try: typeof i.try === 'string' && i.try.trim() ? i.try : undefined,
    }))
  if (!insights.length) throw new AiError('format', 'The AI answer had no insights. Try again.')
  const seeDoctor = typeof o.see_doctor === 'string' && o.see_doctor.trim() ? o.see_doctor : null
  return { summary: typeof o.summary === 'string' ? o.summary : '', insights, seeDoctor }
}

export async function createInsights(kid: KidInfo, mine: Entry[], allKids: KidInfo[]): Promise<SavedInsights> {
  const summary = childSummary(kid, mine, allKids)
  const user = `Here are the logs for the last 14 days.\n\n${summary}\n\nWrite 3 to 5 insights about sleep, eating and potty or diapers, most useful first. Each "try" is one small, concrete step for the coming week.\nReply in json only, in exactly this format:\n${EXAMPLE}`
  // JSON mode sometimes returns an empty answer; one retry covers it.
  let result: AiInsightResult | undefined
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      result = parseInsights(await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], { json: true, maxTokens: 3000 }))
    } catch (e) {
      if (!(e instanceof AiError && e.kind === 'format') || attempt === 1) throw e
    }
  }
  const saved = { createdAt: Date.now(), result: result! }
  await setSetting(`ai-insights:${kid.id}`, saved)
  return saved
}

export const getSavedInsights = (kidId: string) => getSetting<SavedInsights>(`ai-insights:${kidId}`)

export async function askAi(question: string, kid: KidInfo, mine: Entry[], allKids: KidInfo[]): Promise<string> {
  const summary = childSummary(kid, mine, allKids)
  const scrubbedQuestion = scrubNames(question, kid, allKids, 'my child')
  return chat(
    [
      { role: 'system', content: SYSTEM + '\nAnswer in at most 150 words. No headings. Short paragraphs or a few bullet points are fine.' },
      { role: 'user', content: `Logs for the last 14 days:\n\n${summary}\n\nMy question: ${scrubbedQuestion}` },
    ],
    { maxTokens: 1200 },
  )
}
