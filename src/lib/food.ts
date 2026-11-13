import { D, dayStart } from './time'
import type { Entry, KidInfo, Menu } from './types'

export type NutrientId = 'iron' | 'zinc' | 'fats' | 'vitac' | 'calcium' | 'vitd' | 'fiber' | 'protein'
export type GroupId = 'veg' | 'fruit' | 'grain' | 'protein' | 'dairy'

/** Simplified food lookup: food group and the key nutrients it is a good source of. Longest names match first. */
const FOODS: Record<string, [GroupId, NutrientId[]]> = {
  'sweet potato': ['veg', ['vitac', 'fiber']],
  'iron-fortified cereal': ['grain', ['iron', 'zinc']],
  cereal: ['grain', ['iron']],
  lentil: ['protein', ['iron', 'zinc', 'fiber', 'protein']],
  bean: ['protein', ['iron', 'fiber', 'protein']],
  beef: ['protein', ['iron', 'zinc', 'protein']],
  chicken: ['protein', ['zinc', 'protein']],
  salmon: ['protein', ['fats', 'vitd', 'protein']],
  fish: ['protein', ['fats', 'vitd', 'protein']],
  tofu: ['protein', ['iron', 'calcium', 'protein']],
  egg: ['protein', ['iron', 'vitd', 'fats', 'protein']],
  yogurt: ['dairy', ['calcium', 'protein']],
  cheese: ['dairy', ['calcium', 'protein']],
  milk: ['dairy', ['calcium', 'vitd']],
  oat: ['grain', ['iron', 'zinc', 'fiber']],
  pasta: ['grain', []],
  rice: ['grain', []],
  toast: ['grain', ['fiber']],
  bread: ['grain', ['fiber']],
  cracker: ['grain', []],
  pancake: ['grain', []],
  wrap: ['grain', []],
  broccoli: ['veg', ['vitac', 'calcium', 'fiber']],
  spinach: ['veg', ['iron', 'vitac']],
  pea: ['veg', ['fiber', 'protein', 'vitac']],
  carrot: ['veg', ['vitac']],
  potato: ['veg', ['vitac']],
  cucumber: ['veg', []],
  veg: ['veg', ['vitac', 'fiber']],
  avocado: ['fruit', ['fats', 'fiber']],
  banana: ['fruit', ['fiber']],
  apple: ['fruit', ['fiber', 'vitac']],
  pear: ['fruit', ['fiber', 'vitac']],
  berr: ['fruit', ['vitac', 'fiber']],
  orange: ['fruit', ['vitac']],
  mango: ['fruit', ['vitac']],
}
const FOOD_KEYS = Object.keys(FOODS).sort((a, b) => b.length - a.length)

export function analyse(text: string): [GroupId, NutrientId[]][] {
  let t = (text || '').toLowerCase()
  const out: [GroupId, NutrientId[]][] = []
  for (const k of FOOD_KEYS) {
    if (t.includes(k)) {
      out.push(FOODS[k])
      t = t.split(k).join(' ')
    }
  }
  return out
}

export const NUTRIENTS: Record<NutrientId, { name: string; why: string; foods: string }> = {
  iron: { name: 'Iron', why: 'Builds blood and supports brain growth.', foods: 'beef, lentils, beans, iron-fortified cereal, eggs, tofu' },
  zinc: { name: 'Zinc', why: 'Supports growth and the immune system.', foods: 'beef, chicken, lentils, oats, eggs' },
  fats: { name: 'Healthy fats', why: 'Fuel for the fast-growing brain.', foods: 'avocado, salmon, eggs, full-fat yogurt' },
  vitac: { name: 'Vitamins A and C', why: 'Eyes, skin, immunity, and C helps the body absorb iron.', foods: 'sweet potato, carrot, broccoli, berries, mango' },
  calcium: { name: 'Calcium', why: 'Strong bones and teeth.', foods: 'milk, yogurt, cheese, tofu, broccoli' },
  vitd: { name: 'Vitamin D', why: 'Helps the body use calcium.', foods: 'salmon, eggs, fortified milk. Ask your doctor about drops.' },
  fiber: { name: 'Fiber', why: 'Keeps digestion regular.', foods: 'oats, beans, pears, berries, whole-grain bread' },
  protein: { name: 'Protein', why: 'Muscles and growth.', foods: 'eggs, chicken, fish, beans, yogurt' },
}

export const keyNutrients = (k: KidInfo): NutrientId[] =>
  k.ageM < 12 ? ['iron', 'zinc', 'fats', 'vitac'] : ['iron', 'calcium', 'vitd', 'fiber', 'protein']

/** Food group, label, rough servings-a-day target for a toddler. */
export const GROUPS: [GroupId, string, number][] = [
  ['veg', 'Vegetables', 2.5],
  ['fruit', 'Fruit', 1.5],
  ['grain', 'Grains', 3.5],
  ['protein', 'Protein', 2],
  ['dairy', 'Dairy', 2.5],
]

export const slotsFor = (k: KidInfo) => (k.ageM < 12 ? ['Breakfast', 'Lunch'] : ['Breakfast', 'Lunch', 'Snack', 'Dinner'])
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TODDLER_MENU = [
  ['Oatmeal with berries', 'Lentil soup', 'Apple slices', 'Salmon and broccoli'],
  ['Yogurt and banana', 'Chicken and rice', 'Cheese cubes', 'Beef and sweet potato'],
  ['Eggs and toast', 'Pasta with peas', 'Banana', 'Tofu and veg'],
  ['Oatmeal with pear', 'Bean wrap', 'Yogurt', 'Chicken and peas'],
  ['Cheese toast', 'Fish and potato', 'Pear', 'Lentils and rice'],
  ['Pancakes and berries', 'Rice and veg', 'Berries', 'Fish and potato'],
  ['Eggs and spinach', 'Pasta with beef', 'Crackers and cheese', 'Eggs and spinach'],
]
const BABY_MENU = [
  ['Iron-fortified cereal', 'Sweet potato'],
  ['Oats and pear', 'Mashed lentils'],
  ['Mashed banana', 'Carrot'],
  ['Iron-fortified cereal', 'Beef purée'],
  ['Oats and apple', 'Avocado'],
  ['Mashed banana', 'Pea purée'],
  ['Iron-fortified cereal', 'Broccoli'],
]

/** An example week to start from, per kid. */
export function exampleMenu(k: KidInfo): Record<string, string>[] {
  const src = k.ageM < 12 ? BABY_MENU : TODDLER_MENU
  return src.map((day) => Object.fromEntries(slotsFor(k).map((sl, i) => [sl, day[i] ?? ''])))
}

/** Saved menu, with an example week filled in for any kid that has none yet. */
export function fullMenu(saved: Menu | undefined, kids: KidInfo[]): Menu {
  const m: Menu = { ...(saved ?? {}) }
  for (const k of kids) if (!m[k.id]) m[k.id] = exampleMenu(k)
  return m
}

/** What was eaten each of the last 7 days (oldest first), with the "Lunch:" prefix removed. */
export function weekFood(mine: Entry[]): string[][] {
  const days: string[][] = []
  for (let o = -6; o <= 0; o++) {
    const a = dayStart(o)
    const b = a + D
    days.push(
      mine
        .filter((e) => e.type === 'feed' && e.start >= a && e.start < b && e.details?.food)
        .map((e) => e.details.food!.replace(/^[A-Za-z]+:\s*/, '')),
    )
  }
  return days
}
