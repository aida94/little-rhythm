import { describe, expect, it, vi } from 'vitest'
import { withAge } from './kids'
import { at, monthsAgoIso } from './time'

const sent: string[] = []
vi.mock('./ai', async (orig) => ({
  ...(await orig<typeof import('./ai')>()),
  chat: vi.fn(async (messages: { content: string }[]) => {
    sent.push(messages.map((m) => m.content).join('\n'))
    return JSON.stringify({ entries: [{ child: 'Child B', type: 'note', start: '2020-01-01 10:00', note: 'Child B smiled at Child A', said: 'x' }] })
  }),
}))

const { hideNames, parseSayAi, readAiEntries, readStamp, showNames } = await import('./aiSay')

const mila = withAge({ id: 'a', name: 'Mila', birth: monthsAgoIso(30), color: '#000', gender: 'girl', stage: 'Potty' })
const sam = withAge({ id: 'b', name: 'Sam', birth: monthsAgoIso(6), color: '#000', gender: 'boy', stage: 'Diaper' })
const kids = [mila, sam]
const now = at(0, 15)
const stamp = (d: number) => {
  const x = new Date(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`
}

describe('names', () => {
  it('hides and restores names', () => {
    const hidden = hideNames('Mila fed Sam, then mila slept', kids)
    expect(hidden).toBe('Child A fed Child B, then Child A slept')
    expect(showNames(hidden, kids)).toBe('Mila fed Sam, then Mila slept')
  })

  it('never sends a name to the AI', async () => {
    sent.length = 0
    const out = await parseSayAi('Sam smiled at Mila this morning', kids, mila, now)
    expect(sent.join('\n')).not.toMatch(/mila|sam/i)
    expect(out[0].kid).toBe('b')
    expect(out[0].note).toBe('Sam smiled at Mila')
  })
})

describe('readAiEntries', () => {
  const read = (entries: unknown[]) => readAiEntries(JSON.stringify({ entries }), kids, mila, now)

  it('reads stamps as local time', () => {
    expect(readStamp('2026-03-04 07:05')).toBe(new Date(2026, 2, 4, 7, 5).getTime())
    expect(readStamp('nonsense')).toBeNull()
  })

  it('turns food into a Food entry with its time of day', () => {
    const [e] = read([{ child: 'Child A', type: 'feed', start: stamp(at(0, 12)), method: 'Food', food: 'pasta', mealTime: 'Lunch', amount: 'A little' }])
    expect(e.details).toEqual({ method: 'Meal', food: 'Lunch: pasta', amount: 'A little' })
  })

  it('uses potty words for a potty child and diaper words for a baby', () => {
    const [a, b] = read([
      { child: 'Child A', type: 'diaper', start: stamp(at(0, 10)), poop: true, pee: false, color: 'Green' },
      { child: 'Child B', type: 'diaper', start: stamp(at(0, 11)), poop: true, pee: false, color: 'Green' },
    ])
    expect(a.details).toEqual({ kind: 'Poop', where: 'In potty' })
    expect(b.details).toEqual({ kind: 'Dirty', color: 'Green' })
  })

  it('keeps times out of the future and drops impossible sleeps', () => {
    const out = read([
      { type: 'note', start: stamp(at(0, 18)), note: 'later' },
      { type: 'sleep', start: stamp(at(0, 13)), end: stamp(at(0, 12)) },
      { type: 'sleep', start: stamp(at(0, 14)), end: stamp(at(0, 17)) },
    ])
    expect(out).toHaveLength(2)
    expect(out.find((e) => e.type === 'note')!.start).toBe(now)
    expect(out.find((e) => e.type === 'sleep')!.end).toBeNull()
  })

  it('falls back to the default child', () => {
    const [e] = read([{ child: 'Someone', type: 'note', start: stamp(at(0, 9)), note: 'hi' }])
    expect(e.kid).toBe('a')
  })

  it('rejects answers that are not the expected JSON', () => {
    expect(() => readAiEntries('hello', kids, mila, now)).toThrow()
    expect(() => readAiEntries('{"items":[]}', kids, mila, now)).toThrow()
  })
})
