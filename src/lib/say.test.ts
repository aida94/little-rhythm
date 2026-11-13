import { describe, expect, it } from 'vitest'
import { withAge } from './kids'
import { parseSay } from './say'
import { at, hm, monthsAgoIso } from './time'

const mila = withAge({ id: 'a', name: 'Mila', birth: monthsAgoIso(24), color: '#000', stage: 'Potty' })
const sam = withAge({ id: 'b', name: 'Sam', birth: monthsAgoIso(6), color: '#000', stage: 'Diaper' })
const kids = [mila, sam]
// Late in the day, so afternoon times are in the past.
const now = at(0, 21, 30)
const say = (text: string) => parseSay(text, kids, mila, now)

describe('parseSay', () => {
  it('reads a nap with a length and a start time', () => {
    const [e] = say('today mila sleept 3 hour from 1.00')
    expect(e).toMatchObject({ kid: 'a', type: 'sleep', details: { kind: 'Nap' } })
    expect(hm(e.start)).toBe('13:00')
    expect(hm(e.end!)).toBe('16:00')
  })

  it('reads a bottle with ml for the named kid', () => {
    const [e] = say('Sam had a 150 ml bottle at 7')
    expect(e).toMatchObject({ kid: 'b', type: 'feed', details: { method: 'Bottle', ml: 150 } })
  })

  it('reads a meal with food', () => {
    const [e] = say('Mila ate pasta with peas for lunch')
    expect(e).toMatchObject({ type: 'feed', details: { method: 'Meal', food: 'Lunch: pasta with peas' } })
  })

  it('reads potty with an accident and splits sentences', () => {
    const es = say('Mila had an accident, peed at 3pm. Sam breastfed left for 15 min at 9')
    expect(es).toHaveLength(2)
    expect(es[0]).toMatchObject({ kid: 'a', type: 'diaper', details: { kind: 'Pee', accident: true } })
    expect(hm(es[0].start)).toBe('15:00')
    expect(es[1]).toMatchObject({ kid: 'b', type: 'feed', details: { method: 'Breast', side: 'Left', minutes: 15 } })
  })

  it('uses diaper words for a kid in diapers', () => {
    const [e] = say('Sam pooped at 10')
    expect(e.details.kind).toBe('Dirty')
  })

  it('reads last night with an end time', () => {
    const [e] = say('Sam slept from 8 pm until 6 am yesterday')
    expect(e).toMatchObject({ kid: 'b', type: 'sleep', details: { kind: 'Night' } })
    expect(e.start).toBe(at(-1, 20))
    expect(e.end).toBe(at(0, 6))
  })

  it('splits after a time like 1.00 that ends a sentence', () => {
    const es = say('today mila sleept 3 hour from 1.00. Sam had a 150 ml bottle at 7')
    expect(es.map((e) => [e.kid, e.type])).toEqual([
      ['a', 'sleep'],
      ['b', 'feed'],
    ])
    expect(hm(es[0].end!)).toBe('16:00')
  })

  it('keeps anything else as a note', () => {
    const [e] = say('Mila has a cough')
    expect(e).toMatchObject({ type: 'note', note: 'Mila has a cough' })
  })
})
