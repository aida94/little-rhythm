export type EntryType = 'sleep' | 'feed' | 'diaper' | 'note'
export type Stage = 'Diaper' | 'Training' | 'Potty'
export type Gender = 'girl' | 'boy' | 'unspecified'

/** Per-type extras. Fields are optional so new ones can be added without migrating old entries. */
export interface Details {
  kind?: string // sleep: Nap | Night · diaper: Wet | Dirty | Pee | Poop | Both
  method?: string // feed: Breast | Bottle | Solids | Meal
  ml?: number | null
  minutes?: number | null
  side?: string
  food?: string | null
  amount?: string
  color?: string
  texture?: string
  where?: string // potty: In potty | Accident | In diaper
  accident?: boolean
}

export interface Entry {
  id: string
  kid: string
  type: EntryType
  start: number // ms since epoch
  end?: number | null // sleep only; empty while the sleep is running
  details: Details
  note?: string
  sample?: boolean
}

export interface Kid {
  id: string
  name: string
  birth: string // YYYY-MM-DD
  color: string
  gender?: Gender
  stage?: Stage
}

/** A kid with age worked out for today. */
export interface KidInfo extends Kid {
  ageM: number
  age: string
  stage: Stage
}

/** menu[kidId][dayIndex 0=Mon][slot] = food */
export type Menu = Record<string, Record<string, string>[]>
