import { AiError, chat, getAiSettings } from './ai'
import { db, getSetting, setSetting } from './db'
import { splitFood } from './entries'

/**
 * Emoji for food and drinks.
 * - localEmoji: instant, offline, from a built-in word list.
 * - aiEmoji: asks the AI for the best emoji; answers are cached per food so each food is asked once.
 * Up to 3 emoji per entry, saved in entry.details.emoji.
 */

const MAX = 3

/** Word (start of word, so "apples" and "banana's" match) → emoji. Longer phrases first. */
const WORDS: [string, string][] = [
  ['sweet potato', '🍠'],
  ['ice cream', '🍨'],
  ['hot dog', '🌭'],
  ['hamburger', '🍔'],
  ['french fries', '🍟'],
  ['green bean', '🫛'],
  ['peanut butter', '🥜'],
  ['apple', '🍎'],
  ['banana', '🍌'],
  ['pear', '🍐'],
  ['orange', '🍊'],
  ['mandarin', '🍊'],
  ['clementine', '🍊'],
  ['grape', '🍇'],
  ['strawberr', '🍓'],
  ['blueberr', '🫐'],
  ['raspberr', '🍓'],
  ['berr', '🫐'],
  ['cherr', '🍒'],
  ['peach', '🍑'],
  ['mango', '🥭'],
  ['pineapple', '🍍'],
  ['melon', '🍈'],
  ['watermelon', '🍉'],
  ['kiwi', '🥝'],
  ['lemon', '🍋'],
  ['avocado', '🥑'],
  ['tomato', '🍅'],
  ['cucumber', '🥒'],
  ['carrot', '🥕'],
  ['broccoli', '🥦'],
  ['corn', '🌽'],
  ['pea', '🫛'],
  ['pepper', '🫑'],
  ['potato', '🥔'],
  ['mushroom', '🍄'],
  ['spinach', '🥬'],
  ['lettuce', '🥬'],
  ['salad', '🥗'],
  ['veg', '🥦'],
  ['pasta', '🍝'],
  ['spaghetti', '🍝'],
  ['noodle', '🍜'],
  ['rice', '🍚'],
  ['bread', '🍞'],
  ['toast', '🍞'],
  ['sandwich', '🥪'],
  ['wrap', '🌯'],
  ['pancake', '🥞'],
  ['waffle', '🧇'],
  ['croissant', '🥐'],
  ['bagel', '🥯'],
  ['cracker', '🍘'],
  ['cereal', '🥣'],
  ['muesli', '🥣'],
  ['granola', '🥣'],
  ['almond', '🥜'],
  ['seed', '🌻'],
  ['porridge', '🥣'],
  ['oat', '🥣'],
  ['soup', '🍲'],
  ['pizza', '🍕'],
  ['burger', '🍔'],
  ['fries', '🍟'],
  ['egg', '🥚'],
  ['chicken', '🍗'],
  ['beef', '🥩'],
  ['meat', '🥩'],
  ['steak', '🥩'],
  ['sausage', '🌭'],
  ['ham', '🍖'],
  ['bacon', '🥓'],
  ['fish', '🐟'],
  ['salmon', '🐟'],
  ['tuna', '🐟'],
  ['shrimp', '🍤'],
  ['tofu', '🫘'],
  ['bean', '🫘'],
  ['lentil', '🫘'],
  ['hummus', '🫘'],
  ['cheese', '🧀'],
  ['yogurt', '🥛'],
  ['yoghurt', '🥛'],
  ['milk', '🥛'],
  ['butter', '🧈'],
  ['nut', '🥜'],
  ['cookie', '🍪'],
  ['biscuit', '🍪'],
  ['cake', '🍰'],
  ['muffin', '🧁'],
  ['chocolate', '🍫'],
  ['candy', '🍬'],
  ['sweet', '🍬'],
  ['popcorn', '🍿'],
  ['water', '💧'],
  ['juice', '🧃'],
  ['smoothie', '🥤'],
  ['tea', '🍵'],
]

/** Instant emoji from the built-in list, in the order the foods are written. */
export function localEmoji(food: string | null | undefined): string {
  const t = ' ' + splitFood(food).what.toLowerCase() + ' '
  const found: { at: number; e: string }[] = []
  const taken: [number, number][] = []
  for (const [w, e] of WORDS) {
    const re = new RegExp(`(?<![a-z])${w.replace(/ /g, '\\s+')}`, 'g')
    for (const m of t.matchAll(re)) {
      const a = m.index!
      const b = a + m[0].length
      if (taken.some(([x, y]) => a < y && x < b)) continue // "sweet potato" already matched, skip "potato"
      taken.push([a, b])
      found.push({ at: a, e })
    }
  }
  const out: string[] = []
  for (const f of found.sort((a, b) => a.at - b.at)) if (!out.includes(f.e)) out.push(f.e)
  return out.slice(0, MAX).join('')
}

/** Keep only emoji characters, at most 3, no repeats. */
export function cleanEmoji(s: unknown): string {
  if (typeof s !== 'string') return ''
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const out: string[] = []
  for (const { segment } of seg.segment(s)) {
    if (/\p{Extended_Pictographic}/u.test(segment) && !out.includes(segment)) out.push(segment)
    if (out.length === MAX) break
  }
  return out.join('')
}

/** The first emoji, for the small icon in the list. */
export function firstEmoji(s: string | undefined): string {
  if (!s) return ''
  const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next()
  return first.done ? '' : first.value.segment
}

const CACHE = 'food-emoji'
const key = (food: string) => splitFood(food).what.toLowerCase().replace(/\s+/g, ' ').trim()

/** Ask the AI for emoji that match the food. Cached per food text. Returns '' when nothing fits. */
export async function aiEmoji(food: string): Promise<string> {
  const k = key(food)
  if (!k) return ''
  const cache = (await getSetting<Record<string, string>>(CACHE)) ?? {}
  if (k in cache) return cache[k]
  const raw = await chat(
    [
      {
        role: 'system',
        content:
          'You pick emoji for foods and drinks a child ate or drank. Reply in json only: {"emoji":"…"} with 1 to 3 emoji, the main food first, one per food or drink. Use only food and drink emoji. If nothing fits, use "🍽️".',
      },
      { role: 'user', content: `Food: """${k.slice(0, 200)}"""\nReply in json only, like {"emoji":"🍝🥦"}` },
    ],
    { json: true, maxTokens: 60 },
  )
  let emoji = ''
  try {
    emoji = cleanEmoji(JSON.parse(raw)?.emoji)
  } catch {
    throw new AiError('format', 'The AI answer could not be read.')
  }
  await setSetting(CACHE, { ...cache, [k]: emoji })
  return emoji
}

/** After saving: let the AI improve the emoji of a food entry, in the background. Fails silently. */
export async function improveEmojiLater(entryId: string): Promise<void> {
  try {
    if (!(await getAiSettings())?.apiKey) return
    const e = await db.entries.get(entryId)
    const food = e?.details.food
    if (!e || !food) return
    const emoji = await aiEmoji(food)
    if (!emoji) return
    const now = await db.entries.get(entryId)
    // Only if the food was not changed meanwhile.
    if (now && now.details.food === food && now.details.emoji !== emoji) await db.entries.update(entryId, { details: { ...now.details, emoji } })
  } catch {
    /* the built-in emoji stay */
  }
}
