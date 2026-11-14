import { AiError, chat } from './ai'
import { getSetting, setSetting } from './db'
import { splitFood } from './entries'
import { DAYS, GROUPS, NUTRIENTS, analyse, slotsFor, type GroupId, type NutrientId } from './food'
import { D, dayStart } from './time'
import type { Entry, KidInfo, Menu } from './types'

/**
 * Food with AI:
 * - foodFacts: food groups (servings) and key nutrients per food, asked once per food text and cached.
 * - weekIntake: what a child ate in the last 7 days, weighted by how much was eaten.
 * - planMenu: a 7-day menu made by the AI from the child's age and what they ate, liked and refused.
 * Only food text, amounts and age are sent. Never names.
 */

export interface FoodFacts {
  groups: Partial<Record<GroupId, number>> // servings in one child-sized portion
  nutrients: NutrientId[]
}

const GROUP_IDS = GROUPS.map(([g]) => g)
const NUTRIENT_IDS = Object.keys(NUTRIENTS) as NutrientId[]
const CACHE = 'food-facts'

/** Cache key: the food without "Lunch:", lower case, single spaces. */
export const foodKey = (food: string | null | undefined) => splitFood(food).what.toLowerCase().replace(/\s+/g, ' ').trim()

/** From the built-in food list: one serving per food found. */
export function localFacts(food: string): FoodFacts {
  const groups: Partial<Record<GroupId, number>> = {}
  const nutrients = new Set<NutrientId>()
  for (const [g, ns] of analyse(food)) {
    groups[g] = (groups[g] ?? 0) + 1
    ns.forEach((n) => nutrients.add(n))
  }
  return { groups, nutrients: [...nutrients] }
}

export const getFactsCache = async () => (await getSetting<Record<string, FoodFacts>>(CACHE)) ?? {}

/** How much of the portion was eaten. */
export const AMOUNT: Record<string, number> = { None: 0, 'A little': 0.25, Half: 0.5, Most: 0.75, All: 1 }

export interface DayIntake {
  date: number
  foods: { text: string; emoji?: string; amount?: string; when: string }[]
  groups: Record<GroupId, number>
  nutrients: Set<NutrientId>
  /** Which foods gave each nutrient that day (only foods that were at least partly eaten). */
  sources: Partial<Record<NutrientId, { text: string; emoji?: string; amount?: string }[]>>
}

/** The last 7 days (oldest first): foods eaten, servings per group and nutrients, weighted by amount. */
export function weekIntake(mine: Entry[], facts: (food: string) => FoodFacts): DayIntake[] {
  const days: DayIntake[] = []
  for (let o = -6; o <= 0; o++) {
    const a = dayStart(o)
    const day: DayIntake = { date: a, foods: [], groups: Object.fromEntries(GROUP_IDS.map((g) => [g, 0])) as Record<GroupId, number>, nutrients: new Set(), sources: {} }
    const credit = (n: NutrientId, src: { text: string; emoji?: string; amount?: string }) => {
      day.nutrients.add(n)
      ;(day.sources[n] ??= []).push(src)
    }
    for (const e of mine.filter((x) => x.type === 'feed' && x.start >= a && x.start < a + D).sort((x, y) => x.start - y.start)) {
      const d = e.details
      if (d.method === 'Bottle' && d.ml) {
        // A bottle of milk: about 240 ml is one dairy serving.
        day.groups.dairy += d.ml / 240
        const milk = { text: `milk bottle, ${d.ml} ml`, emoji: '🍼' }
        credit('calcium', milk)
        credit('vitd', milk)
        continue
      }
      if (!d.food) continue
      const { when, what } = splitFood(d.food)
      day.foods.push({ text: what, emoji: d.emoji, amount: d.amount, when })
      const share = AMOUNT[d.amount ?? 'Most'] ?? 0.75
      if (!share) continue
      const f = facts(d.food)
      for (const g of GROUP_IDS) day.groups[g] += (f.groups[g] ?? 0) * share
      f.nutrients.forEach((n) => credit(n, { text: what || when, emoji: d.emoji, amount: d.amount }))
    }
    days.push(day)
  }
  return days
}

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(v, 4) : 0)

/** Check the AI's facts for one food. */
export function readFacts(raw: unknown): FoodFacts | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { groups?: Record<string, unknown>; nutrients?: unknown }
  const groups: Partial<Record<GroupId, number>> = {}
  for (const g of GROUP_IDS) {
    const v = num(r.groups?.[g])
    if (v) groups[g] = Math.round(v * 4) / 4
  }
  const nutrients = Array.isArray(r.nutrients) ? (r.nutrients.filter((n) => NUTRIENT_IDS.includes(n as NutrientId)) as NutrientId[]) : []
  return { groups, nutrients: [...new Set(nutrients)] }
}

/** Ask the AI about foods it has not seen yet (up to 40 at a time). Saves the answers in the cache. */
export async function analyseFoodsAi(foods: string[]): Promise<number> {
  const cache = await getFactsCache()
  const todo = [...new Set(foods.map(foodKey).filter((k) => k && !(k in cache)))].slice(0, 40)
  if (!todo.length) return 0
  const raw = await chat(
    [
      {
        role: 'system',
        content: `You are a children's nutrition helper. For each food a young child ate, give the food groups in servings for one child-sized portion, and the key nutrients it is a good source of.
Groups: veg, fruit, grain, protein, dairy. Use 0.25 steps, for example pasta with peas = {"grain":1,"veg":0.5}.
Nutrients (only these ids): ${NUTRIENT_IDS.join(', ')} (vitac means vitamins A and C, fats means healthy fats, vitd means vitamin D).
Drinks: water and juice have no groups; milk is dairy. Sweets and snacks may have no groups.
Reply in json only.`,
      },
      {
        role: 'user',
        content: `Foods:\n${todo.map((f, i) => `${i + 1}. ${f.slice(0, 120)}`).join('\n')}\n\nReply in json only, one item per food, same order:\n{"foods":[{"food":"pasta with peas","groups":{"grain":1,"veg":0.5},"nutrients":["fiber","protein"]}]}`,
      },
    ],
    { json: true, maxTokens: 3000 },
  )
  let list: unknown[]
  try {
    list = JSON.parse(raw)?.foods
  } catch {
    throw new AiError('format', 'The AI answer could not be read.')
  }
  if (!Array.isArray(list)) throw new AiError('format', 'The AI answer could not be read.')
  const next = { ...cache }
  todo.forEach((k, i) => {
    // Match by name when the AI echoes it, else by position.
    const item = list.find((x) => foodKey((x as { food?: string })?.food) === k) ?? list[i]
    const f = readFacts(item)
    if (f) next[k] = f
  })
  await setSetting(CACHE, next)
  return todo.length
}

// ---------- Weekly menu ----------

export interface MenuNote {
  createdAt: number
  why: string
}
export const getMenuNote = (kidId: string) => getSetting<MenuNote>(`menu-ai:${kidId}`)

/** Short text about what the child ate in the last 14 days: liked, refused and how often. */
function eatingSummary(mine: Entry[], now: number): string {
  const since = now - 14 * D
  const counts = new Map<string, { n: number; ate: number }>()
  for (const e of mine) {
    if (e.type !== 'feed' || e.start < since || !e.details.food) continue
    const k = foodKey(e.details.food)
    if (!k) continue
    const c = counts.get(k) ?? { n: 0, ate: 0 }
    c.n++
    c.ate += AMOUNT[e.details.amount ?? 'Most'] ?? 0.75
    counts.set(k, c)
  }
  if (!counts.size) return 'No meals logged in the last 14 days.'
  const rows = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40)
  return rows.map(([f, c]) => `- ${f}: ${c.n}×, ate ${Math.round((c.ate / c.n) * 100)}% on average`).join('\n')
}

/** Ask the AI for a 7-day menu (Mon–Sun). Returns the new menu for this child and a short why. */
export async function planMenu(
  kid: KidInfo,
  mine: Entry[],
  gaps: { lowNutrients: string[]; lowGroups: string[] },
  now = Date.now(),
): Promise<{ days: Record<string, string>[]; why: string }> {
  const slots = slotsFor(kid)
  const baby = kid.ageM < 12
  const example = JSON.stringify({ why: 'One or two short sentences.', days: DAYS.map(() => Object.fromEntries(slots.map((s) => [s, '…']))).slice(0, 1) })
  const user = `Child: ${kid.ageM} months old.
Meals each day: ${slots.join(', ')}.
What the child ate in the last 14 days (food, times, share of the portion eaten on average):
${eatingSummary(mine, now)}
Low this week: ${[...gaps.lowNutrients, ...gaps.lowGroups].join(', ') || 'nothing in particular'}.

Plan 7 days, Monday to Sunday. Keep foods the child likes (eats most of), bring back refused foods now and then in a new way, and cover what is low.
Each meal is short, like "Oatmeal with pear" or "Chicken, rice and peas".
Reply in json only, exactly like this, with 7 items in "days":
${example}`
  const raw = await chat(
    [
      {
        role: 'system',
        content: `You plan simple, healthy home meals for a young child. ${
          baby
            ? 'Under 12 months: soft purées and mashed foods, iron-rich foods every day, no honey, no added salt or sugar, no cow’s milk as a drink.'
            : 'Toddler: family foods in small pieces, a mix of veg, fruit, grains, protein and dairy every day, little added sugar and salt, no whole nuts or whole grapes.'
        } Write in English. Reply in json only.`,
      },
      { role: 'user', content: user },
    ],
    { json: true, maxTokens: 2500 },
  )
  let data: { days?: unknown; why?: unknown }
  try {
    data = JSON.parse(raw)
  } catch {
    throw new AiError('format', 'The AI answer could not be read. Try again.')
  }
  if (!Array.isArray(data.days) || data.days.length < 7) throw new AiError('format', 'The AI did not send a full week. Try again.')
  const days = data.days.slice(0, 7).map((d) => {
    const row = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>
    return Object.fromEntries(slots.map((s) => [s, typeof row[s] === 'string' ? (row[s] as string).trim().slice(0, 80) : '']))
  })
  if (days.every((d) => slots.every((s) => !d[s]))) throw new AiError('format', 'The AI sent an empty menu. Try again.')
  return { days, why: typeof data.why === 'string' ? data.why.trim().slice(0, 300) : '' }
}

/** Save an AI menu for one child. */
export async function saveAiMenu(menu: Menu, kidId: string, days: Record<string, string>[], why: string) {
  await setSetting('menu', { ...menu, [kidId]: days })
  await setSetting(`menu-ai:${kidId}`, { createdAt: Date.now(), why } satisfies MenuNote)
}

