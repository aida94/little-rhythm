import { isoDate, uid } from './time'
import type { Gender, Kid, KidInfo } from './types'

/** Avatar colors, given out in order as kids are added. */
const KID_COLORS = ['#8A5FCA', '#587CD2', '#2F8A5B', '#C2621F', '#B83A6B', '#3D7F8C']

export const GENDERS: [Gender, string][] = [
  ['girl', 'Girl'],
  ['boy', 'Boy'],
  ['unspecified', 'Prefer not to say'],
]

/** What the add/edit form holds for one kid. */
export interface KidDraft {
  id: string
  name: string
  gender?: Gender
  birth: string
  color: string
  isNew?: boolean
}

export function newKidDraft(existing: { color: string }[]): KidDraft {
  const used = new Set(existing.map((k) => k.color))
  const color = KID_COLORS.find((c) => !used.has(c)) ?? KID_COLORS[existing.length % KID_COLORS.length]
  return { id: uid(), name: '', birth: '', color, isNew: true }
}

/** Empty text if the draft is fine, otherwise what to fix. */
export function draftProblem(d: KidDraft): string {
  if (!d.name.trim()) return 'Add a name'
  if (!d.gender) return `Choose a gender for ${d.name.trim()}`
  if (!d.birth) return `Add the date of birth for ${d.name.trim()}`
  if (d.birth > isoDate()) return 'The date of birth is in the future'
  return ''
}

export const draftToKid = (d: KidDraft): Kid => ({ id: d.id, name: d.name.trim(), gender: d.gender, birth: d.birth, color: d.color })

export function ageMonths(birth: string, now = new Date()): number {
  const b = new Date(birth + 'T12:00')
  let m = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth()
  if (now.getDate() < b.getDate()) m--
  return Math.max(0, m)
}

export function ageLabel(m: number): string {
  if (m < 1) return 'Newborn'
  if (m < 24) return `${m} ${m === 1 ? 'month' : 'months'}`
  const y = Math.floor(m / 12)
  return `${y} years${m < 36 && m % 12 >= 6 ? ` ${m % 12} mo` : ''}`
}

export function withAge(k: Kid, now = new Date()): KidInfo {
  const ageM = ageMonths(k.birth, now)
  return { ...k, ageM, age: ageLabel(ageM), stage: k.stage ?? (ageM < 18 ? 'Diaper' : 'Potty') }
}

export const isPotty = (k: KidInfo) => k.stage !== 'Diaper'
export const isBaby = (k: KidInfo) => k.ageM < 12
