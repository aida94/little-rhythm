import { describe, expect, it } from 'vitest'
import { foodKey, localFacts, readFacts, weekIntake, type FoodFacts } from './foodAi'
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
