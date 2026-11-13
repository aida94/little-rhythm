import { describe, expect, it } from 'vitest'
import { baseUrlProblem, normalizeBaseUrl } from './ai'
import { childSummary, parseInsights, scrubNames } from './aiInsights'
import { withAge } from './kids'
import { at, monthsAgoIso } from './time'
import type { Entry } from './types'

const mila = withAge({ id: 'a', name: 'Mila', birth: monthsAgoIso(24), color: '#000', gender: 'girl', stage: 'Potty' })
const sam = withAge({ id: 'b', name: 'Sam', birth: monthsAgoIso(6), color: '#000', gender: 'boy', stage: 'Diaper' })
const kids = [mila, sam]
const now = at(0, 21)

const entries: Entry[] = [
  { id: '1', kid: 'a', type: 'sleep', start: at(-1, 20, 15), end: at(0, 6, 45), details: { kind: 'Night' } },
  { id: '2', kid: 'a', type: 'feed', start: at(0, 12), details: { method: 'Meal', food: 'Lunch: pasta Mila loves', amount: 'Half' } },
  { id: '3', kid: 'a', type: 'diaper', start: at(0, 10), details: { kind: 'Poop', color: 'Brown', texture: 'Soft', where: 'In potty' } },
  { id: '4', kid: 'a', type: 'note', start: at(0, 18), details: {}, note: 'Mila was grumpy after Sam woke her up' },
]

describe('childSummary', () => {
  const text = childSummary(mila, entries, kids, 3, now)

  it('never contains a name', () => {
    expect(text).not.toMatch(/mila|sam/i)
    expect(text).toContain('the child was grumpy after a sibling woke her up')
  })

  it('describes age, sleep, food and potty', () => {
    expect(text).toContain('girl, 24 months old, uses the potty')
    expect(text).toContain('night 20:15–06:45 (10h 30m)')
    expect(text).toContain('12:00 Lunch: pasta the child loves (half eaten)')
    expect(text).toContain('poop at 10:00 brown soft')
  })

  it('marks empty days', () => {
    expect(text).toMatch(/nothing logged/)
  })
})

describe('scrubNames', () => {
  it('only replaces whole names', () => {
    expect(scrubNames('Samuel saw Sam', mila, kids)).toBe('Samuel saw a sibling')
  })
})

describe('parseInsights', () => {
  it('keeps valid insights and fixes unknown areas', () => {
    const r = parseInsights(
      JSON.stringify({ summary: 'ok', insights: [{ area: 'weird', title: 'T', detail: 'D', try: 'X' }, { title: 'no detail' }], see_doctor: '' }),
    )
    expect(r.insights).toEqual([{ area: 'general', title: 'T', detail: 'D', try: 'X' }])
    expect(r.seeDoctor).toBeNull()
  })

  it('rejects text that is not JSON', () => {
    expect(() => parseInsights('Here are some tips')).toThrow()
  })
})

describe('base URL', () => {
  it('cleans pasted addresses', () => {
    expect(normalizeBaseUrl(' https://api.example.com/v1/ ')).toBe('https://api.example.com/v1')
    expect(normalizeBaseUrl('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/v1')
  })
  it('rejects bad addresses', () => {
    expect(baseUrlProblem('')).not.toBe('')
    expect(baseUrlProblem('api.example.com')).not.toBe('')
    expect(baseUrlProblem('http://api.example.com')).not.toBe('')
    expect(baseUrlProblem('https://api.example.com/v1')).toBe('')
  })
})
