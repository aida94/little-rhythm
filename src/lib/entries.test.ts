import { describe, expect, it } from 'vitest'
import { planSleep } from './entries'
import { at } from './time'
import type { Entry } from './types'

const now = at(0, 15)
const sleep = (id: string, start: number, end: number | null): Entry => ({ id, kid: 'a', type: 'sleep', start, end, details: { kind: 'Nap' } })

describe('planSleep', () => {
  it('starts a live sleep', () => {
    expect(planSleep('14:50', null, [], now)).toEqual({ start: at(0, 14, 50), end: null })
  })

  it('logs a night across midnight', () => {
    expect(planSleep('20:15', '06:45', [], at(0, 8))).toEqual({ start: at(-1, 20, 15), end: at(0, 6, 45) })
  })

  it('refuses a second running sleep', () => {
    expect(planSleep('14:50', null, [sleep('r', at(0, 14), null)], now)).toHaveProperty('error')
  })

  it('allows an earlier sleep while one is running', () => {
    const others = [sleep('r', at(0, 14), null)]
    expect(planSleep('10:00', '11:00', others, now)).toEqual({ start: at(0, 10), end: at(0, 11) })
  })

  it('refuses overlapping sleeps', () => {
    const others = [sleep('r', at(0, 14), null), sleep('n', at(0, 9), at(0, 10))]
    expect(planSleep('13:30', '14:30', others, now)).toHaveProperty('error')
    expect(planSleep('09:30', '11:00', others, now)).toHaveProperty('error')
  })

  it('refuses sleeps longer than 16 hours', () => {
    expect(planSleep('14:00', '13:00', [], now)).toHaveProperty('error')
  })
})
