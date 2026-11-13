import { at, uid } from './time'
import { isPotty } from './kids'
import type { Entry, KidInfo } from './types'

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
const pick = <T,>(xs: T[]) => xs[rnd(0, xs.length - 1)]

/**
 * Five weeks of made-up entries for each kid: a baby pattern under 1 year, a toddler pattern from 1 year.
 * All are marked sample, so they can be removed again in Settings.
 */
export function sampleEntries(kids: KidInfo[], now = Date.now()): Entry[] {
  const E: Entry[] = []
  const add = (e: Omit<Entry, 'id'>) => {
    if (e.start < now && (!e.end || e.end < now)) E.push({ id: uid(), sample: true, ...e })
  }
  for (const k of kids) {
    const kid = k.id
    const potty = isPotty(k)
    for (let d = -35; d <= 0; d++) {
      if (k.ageM < 12) {
        // Baby: 3 naps, bottles every ~3h, solids at lunch, ~6 diapers
        add({ kid, type: 'sleep', start: at(d, 19, 15 + rnd(-10, 25)), end: at(d + 1, 6, rnd(0, 40)), details: { kind: 'Night' } })
        add({ kid, type: 'sleep', start: at(d, 9, rnd(15, 40)), end: at(d, 10, rnd(15, 50)), details: { kind: 'Nap' } })
        add({ kid, type: 'sleep', start: at(d, 13, rnd(10, 40)), end: at(d, 14, rnd(20, 59)), details: { kind: 'Nap' } })
        if (d > -4) add({ kid, type: 'sleep', start: at(d, 17, rnd(0, 15)), end: at(d, 17, rnd(30, 45)), details: { kind: 'Nap' } })
        for (const [h, m] of [[6, 45], [10, 0], [13, 0], [16, 15], [19, 0]])
          add({ kid, type: 'feed', start: at(d, h, m + rnd(0, 14)), details: { method: 'Bottle', ml: rnd(15, 20) * 10, minutes: rnd(10, 25) } })
        if (k.ageM >= 5)
          add({ kid, type: 'feed', start: at(d, 11, 30 + rnd(0, 20)), details: { method: 'Solids', food: pick(['Sweet potato', 'Banana', 'Avocado', 'Pear and oats', 'Carrot']), amount: pick(['A little', 'Half', 'Most']) } })
      } else {
        // Toddler: one nap and four meals
        add({ kid, type: 'sleep', start: at(d, 20, rnd(0, 40)), end: at(d + 1, 6, 40 + rnd(0, 40)), details: { kind: 'Night' } })
        add({ kid, type: 'sleep', start: at(d, 13, rnd(0, 20)), end: at(d, 14, rnd(15, 55)), details: { kind: 'Nap' } })
        for (const [n, h, m] of [['Breakfast', 7, 30], ['Lunch', 12, 0], ['Snack', 15, 30], ['Dinner', 18, 0]] as const) {
          const food = n === 'Snack' ? pick(['Apple slices', 'Yogurt', 'Crackers']) : pick(['Pasta', 'Eggs and toast', 'Rice and veg', 'Fish and potato'])
          add({ kid, type: 'feed', start: at(d, h, m + rnd(0, 15)), details: { method: 'Meal', food: `${n}: ${food}`, amount: pick(['A little', 'Half', 'Most', 'All']) } })
        }
      }
      // About 6 diapers or potty trips a day, one of them poop
      ;[8, 10, 12, 15, 17, 19].forEach((h, i) => {
        const poop = i === 2
        const accident = potty && !poop && d === -3 && i === 4
        add({
          kid,
          type: 'diaper',
          start: at(d, h, rnd(0, 30)),
          details: potty
            ? poop
              ? { kind: 'Poop', color: 'Brown', texture: 'Soft', where: 'In potty' }
              : { kind: 'Pee', where: accident ? 'Accident' : 'In potty', ...(accident ? { accident: true } : {}) }
            : poop
              ? { kind: 'Dirty', color: 'Yellow', texture: 'Soft' }
              : { kind: 'Wet' },
        })
      })
    }
    add({ kid, type: 'note', start: at(-2, 21, 0), details: {}, note: k.ageM < 12 ? 'Woke twice, gums look swollen. Gave teether.' : 'Refused vegetables at lunch again.' })
  }
  return E
}
