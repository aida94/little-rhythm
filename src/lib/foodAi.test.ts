import { describe, expect, it } from 'vitest'
import { foodKey, localFacts, mergeFacts, readFacts, weekIntake, type FoodFacts } from './foodAi'
import { at } from './time'
import type { Entry } from './types'

const meal = (id: string, day: number, food: string, amount?: string): Entry => ({ id, kid: 'a', type: 'feed', start: at(day, 12), details: { method: 'Meal', food, amount } })

describe('weekIntake', () => {
  const facts = (f: string): FoodFacts => (foodKey(f) === 'pasta with peas' ? { groups: { grain: 1, veg: 0.5 }, nutrients: ['fiber'] } : localFacts(f))

  it('weights servings by how much was eaten', () => {
    const days = weekIntake([meal('1', 0, 'Lunch: pasta with peas', 'Half'), meal('2', 0, 'pasta with peas', 'All')], facts)
    const today = days[6]
    expect(today.groups.grain).toBe(1.5)
    expect(today.groups.veg).toBe(0.75)
    expect(today.foods.map((f) => f.when)).toEqual(['Lunch', ''])
  })

  it('refused food adds nothing, but is listed', () => {
    const [today] = weekIntake([meal('1', 0, 'pasta with peas', 'None')], facts).slice(-1)
    expect(today.groups.grain).toBe(0)
    expect(today.nutrients.size).toBe(0)
    expect(today.foods).toHaveLength(1)
  })

  it('counts milk bottles as dairy', () => {
    const bottle: Entry = { id: 'b', kid: 'a', type: 'feed', start: at(-1, 8), details: { method: 'Bottle', ml: 240 } }
    const days = weekIntake([bottle], facts)
    expect(days[5].groups.dairy).toBe(1)
    expect(days[5].nutrients.has('calcium')).toBe(true)
  })
})

describe('readFacts', () => {
  it('keeps known groups and nutrients only', () => {
    expect(readFacts({ groups: { veg: 0.6, sweets: 2, grain: -1 }, nutrients: ['iron', 'magic', 'iron'] })).toEqual({ groups: { veg: 0.5 }, nutrients: ['iron'] })
    expect(readFacts('nope')).toBeNull()
  })
})

describe('single foods in a meal', () => {
  const breakfast = (facts: (f: string) => FoodFacts) =>
    weekIntake([{ id: 'm', kid: 'a', type: 'feed', start: at(0, 8), details: { method: 'Meal', food: 'Breakfast: muesli with milk and nuts', amount: 'All' } }], facts)[6]

  it('credits vitamin D to the milk only, not the whole breakfast', () => {
    const day = breakfast(localFacts)
    expect(day.sources.vitd?.map((s) => s.text)).toEqual(['milk'])
    expect(day.sources.vitd?.[0].emoji).toBe('🥛')
    expect(day.sources.iron?.map((s) => s.text)).toEqual(['muesli'])
  })

  it('keeps a nutrient the AI left out (iron in egg)', () => {
    const ai: FoodFacts = { groups: { protein: 1 }, nutrients: ['protein', 'vitd'], parts: [{ name: 'Egg', emoji: '🥚', nutrients: ['protein', 'vitd'] }] }
    const merged = mergeFacts(ai, localFacts('egg'))
    expect(merged.nutrients).toContain('iron')
    expect(merged.parts).toHaveLength(1)
    expect(merged.parts![0].nutrients).toContain('iron')
    expect(merged.groups).toEqual({ protein: 1 })
  })

  it('reads parts from the AI answer', () => {
    const f = readFacts({ groups: { grain: 1 }, nutrients: [], parts: [{ name: 'milk', emoji: '🥛 milk', nutrients: ['vitd', 'x'] }, { nope: 1 }] })
    expect(f?.parts).toEqual([{ name: 'milk', emoji: '🥛', nutrients: ['vitd'] }])
    expect(f?.nutrients).toEqual(['vitd'])
  })
})

describe('numbers in food', () => {
  const protein = (food: string) => localFacts(food).groups.protein
  const grain = (food: string) => localFacts(food).groups.grain

  it('counts a written number', () => {
    expect(protein('egg')).toBe(1)
    expect(protein('2 boiled egg')).toBe(2)
    expect(protein('two eggs')).toBe(2)
    expect(grain('3 slices of toast')).toBe(3)
    expect(protein('half an egg')).toBe(0.5)
  })

  it('counts small foods by the handful', () => {
    expect(grain('2 crackers')).toBe(0.5)
    expect(grain('8 crackers')).toBe(2)
  })

  it('does not count bites, spoons or big numbers as portions', () => {
    expect(grain('a few bites of pasta')).toBe(1)
    expect(localFacts('3 spoons of yogurt').groups.dairy).toBe(1)
    expect(grain('150 g pasta')).toBe(1)
    expect(protein('10 eggs')).toBe(4)
  })

  it('weights the number by how much was eaten', () => {
    const [today] = weekIntake([meal('e', 0, 'Breakfast: 2 boiled eggs', 'Half')], localFacts).slice(-1)
    expect(today.groups.protein).toBe(1)
  })
})
