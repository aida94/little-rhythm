import { useState } from 'react'
import { ChipRow, Field, Sheet } from '../components/ui'
import { db } from '../lib/db'
import { isPoop, planSleep } from '../lib/entries'
import { isPotty } from '../lib/kids'
import { H, MIN, dur, hm, tsFromTime, tsOnDay, uid } from '../lib/time'
import type { Details, Entry, KidInfo, Stage } from '../lib/types'

export interface SheetProps {
  kid: KidInfo
  onClose: () => void
  /** Called after saving, with a short message for the toast. */
  onDone: (msg: string) => void
}

const nowHm = () => hm(Date.now())
const add = (e: Omit<Entry, 'id'>) => db.entries.add({ id: uid(), ...e })

/** Add a new entry, or replace the one being edited (keeping its id). */
const store = (entry: Entry | undefined, e: Omit<Entry, 'id'>) =>
  entry ? db.entries.put({ ...e, id: entry.id, ...(entry.sample ? { sample: true } : {}) }) : add(e)

/** The time field's value as a timestamp. When editing, the entry stays on its own day. */
const when = (hhmm: string, entry?: Entry) => (entry ? tsOnDay(hhmm, entry.start) : tsFromTime(hhmm))

/** Delete button for the edit sheets. First tap asks, second tap deletes. */
function DeleteEntry({ entry, onDone }: { entry: Entry; onDone: (msg: string) => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      className="btn2 danger"
      onClick={async () => {
        if (!armed) return setArmed(true)
        await db.entries.delete(entry.id)
        onDone('Entry deleted')
      }}
    >
      {armed ? 'Tap again to delete' : 'Delete entry'}
    </button>
  )
}

function TimeField({ value, onChange, label = 'Time' }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Field label={label} htmlFor="f-time">
      <input type="time" id="f-time" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function NoteField({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <Field label={required ? 'Note' : 'Note (optional)'} htmlFor="f-note">
      <textarea
        id="f-note"
        value={value}
        autoFocus={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={required ? 'Teething, fever, new food, vaccine day…' : 'Anything to remember'}
      />
    </Field>
  )
}

/** Night if the child fell asleep between 18:00 and 05:00. */
const kindAt = (hhmm: string) => {
  const hr = +hhmm.split(':')[0]
  return hr >= 18 || hr < 5 ? 'Night' : 'Nap'
}

const ASLEEP = 'Still asleep'
const WOKE = 'Woke up'

/** Start a sleep, or log a sleep that already ended. While a sleep is running (`running`),
 *  only past sleeps can be added, and they must end before the running one started. */
export function SleepSheet({ kid, mine, running, entry, onClose, onDone }: SheetProps & { mine: Entry[]; running?: Entry; entry?: Entry }) {
  const [time, setTime] = useState(() => (entry ? hm(entry.start) : running ? hm(running.start - 2 * H) : nowHm()))
  const [kind, setKind] = useState(() => entry?.details.kind ?? kindAt(time))
  const [status, setStatus] = useState(entry ? (entry.end ? WOKE : ASLEEP) : running ? WOKE : ASLEEP)
  const [end, setEnd] = useState(() => (entry?.end ? hm(entry.end) : running && !entry ? hm(running.start - H) : ''))
  const [note, setNote] = useState(entry?.note ?? '')
  const [error, setError] = useState('')
  const pickStatus = (s: string) => {
    setStatus(s)
    setError('')
    if (s === WOKE && !end) {
      setEnd(nowHm())
      if (time === nowHm()) setTime(hm(Date.now() - H))
    }
  }
  const save = async () => {
    const others = entry ? mine.filter((e) => e.id !== entry.id) : mine
    const plan = planSleep(time, status === WOKE ? end : null, others, Date.now(), entry?.start)
    if ('error' in plan) return setError(plan.error.replace('the child', kid.name))
    await store(entry, { kid: kid.id, type: 'sleep', start: plan.start, end: plan.end, details: { kind }, note: note.trim() || undefined })
    onDone(entry ? 'Sleep updated' : plan.end ? 'Sleep saved' : 'Sleep timer started')
  }
  return (
    <Sheet onClose={onClose}>
      <h2>{entry ? 'Edit sleep' : running ? 'Add an earlier sleep' : `${kid.name} is going to sleep`}</h2>
      {running && !entry && <div className="disclaim">{kid.name} is asleep now (since {hm(running.start)}). Add a sleep that ended before that.</div>}
      <Field label="Kind">
        <ChipRow options={['Nap', 'Night']} value={kind} onChange={setKind} />
      </Field>
      {!running && (
        <Field label="Now">
          <ChipRow options={[ASLEEP, WOKE]} value={status} onChange={pickStatus} />
        </Field>
      )}
      {status === WOKE ? (
        <div className="row2">
          <TimeField label="Fell asleep" value={time} onChange={(v) => (setTime(v), setError(''))} />
          <Field label="Woke up" htmlFor="f-end">
            <input type="time" id="f-end" value={end} onChange={(e) => (setEnd(e.target.value), setError(''))} />
          </Field>
        </div>
      ) : (
        <TimeField label="Fell asleep" value={time} onChange={(v) => (setTime(v), setError(''))} />
      )}
      {status === ASLEEP && !entry && (
        <div className="disclaim">A live timer starts. Tap Wake up when {kid.name} wakes.</div>
      )}
      {status === ASLEEP && entry && <div className="disclaim">The sleep stays running until you tap Wake up.</div>}
      <NoteField value={note} onChange={setNote} />
      {error && (
        <div className="hint" role="alert">
          {error}
        </div>
      )}
      <button className="save" onClick={save}>
        {entry ? 'Save changes' : status === WOKE ? 'Save sleep' : 'Start sleep'}
      </button>
      {entry && <DeleteEntry entry={entry} onDone={onDone} />}
    </Sheet>
  )
}

export function WakeSheet({ kid, running, onClose, onDone, onAddEarlier }: SheetProps & { running: Entry; onAddEarlier: () => void }) {
  const [time, setTime] = useState(nowHm)
  const [openedAt] = useState(Date.now)
  const [note, setNote] = useState(running.note ?? '')
  const save = async () => {
    const end = Math.max(running.start + MIN, tsFromTime(time))
    await db.entries.update(running.id, { end, note: note.trim() || undefined })
    onDone('Slept ' + dur(end - running.start))
  }
  return (
    <Sheet onClose={onClose}>
      <h2>{kid.name} woke up</h2>
      <div className="disclaim">
        Asleep since {hm(running.start)} · {dur(openedAt - running.start)}
      </div>
      <TimeField value={time} onChange={setTime} />
      <NoteField value={note} onChange={setNote} />
      <button className="save" onClick={save}>
        Save
      </button>
      <button className="btn2" onClick={onAddEarlier}>
        Add an earlier sleep instead
      </button>
    </Sheet>
  )
}

/** Feed types for the age. An edited entry keeps its own type even if the child has grown. */
const feedOptions = (baby: boolean, current: string) => {
  const opts = baby ? ['Breast', 'Bottle', 'Solids'] : ['Meal', 'Bottle']
  return opts.includes(current) ? opts : [...opts, current]
}

export function FeedSheet({ kid, onClose, onDone, initial, entry }: SheetProps & { initial?: { method?: string; food?: string }; entry?: Entry }) {
  const baby = kid.ageM < 12
  const d = entry?.details
  const [method, setMethod] = useState(d?.method ?? initial?.method ?? (baby ? 'Bottle' : 'Meal'))
  const [ml, setMl] = useState(d?.ml ? String(d.ml) : '')
  const [minutes, setMinutes] = useState(d?.minutes ? String(d.minutes) : '')
  const [side, setSide] = useState(d?.side ?? 'Left')
  const [food, setFood] = useState(d?.food ?? initial?.food ?? '')
  const [amount, setAmount] = useState(d?.amount ?? 'Most')
  const [time, setTime] = useState(() => (entry ? hm(entry.start) : nowHm()))
  const [note, setNote] = useState(entry?.note ?? '')
  const save = async () => {
    const details: Details = { method }
    if (method === 'Bottle') Object.assign(details, { ml: +ml || null, minutes: +minutes || null })
    else if (method === 'Breast') Object.assign(details, { side, minutes: +minutes || null })
    else Object.assign(details, { food: food.trim(), amount })
    await store(entry, { kid: kid.id, type: 'feed', start: when(time, entry), details, note: note.trim() || undefined })
    onDone(entry ? 'Feed updated' : 'Feed saved')
  }
  const minutesField = (ph: string) => (
    <Field label="Minutes" htmlFor="f-min">
      <input type="number" id="f-min" inputMode="numeric" value={minutes} placeholder={ph} onChange={(e) => setMinutes(e.target.value)} />
    </Field>
  )
  return (
    <Sheet onClose={onClose}>
      <h2>{entry ? 'Edit feed' : 'Log a feed'}</h2>
      <Field label="Type">
        <ChipRow options={feedOptions(baby, method)} value={method} onChange={setMethod} />
      </Field>
      {method === 'Bottle' ? (
        <>
          <div className="row2">
            <Field label="Amount (ml)" htmlFor="f-ml">
              <input type="number" id="f-ml" inputMode="numeric" value={ml} placeholder="150" onChange={(e) => setMl(e.target.value)} />
            </Field>
            {minutesField('15')}
          </div>
          <TimeField value={time} onChange={setTime} />
          <div className="disclaim">Time is when the feed started.</div>
        </>
      ) : method === 'Breast' ? (
        <>
          <Field label="Side">
            <ChipRow options={['Left', 'Right', 'Both']} value={side} onChange={setSide} />
          </Field>
          <div className="row2">
            {minutesField('12')}
            <TimeField value={time} onChange={setTime} />
          </div>
        </>
      ) : (
        <>
          <Field label={`What did ${kid.name} eat?`} htmlFor="f-food">
            <input type="text" id="f-food" value={food} placeholder={baby ? 'Mashed banana' : 'Pasta with peas'} onChange={(e) => setFood(e.target.value)} />
          </Field>
          <Field label="How much">
            <ChipRow options={['None', 'A little', 'Half', 'Most', 'All']} value={amount} onChange={setAmount} />
          </Field>
          <TimeField value={time} onChange={setTime} />
        </>
      )}
      <NoteField value={note} onChange={setNote} />
      <button className="save" onClick={save}>
        {entry ? 'Save changes' : 'Save'}
      </button>
      {entry && <DeleteEntry entry={entry} onDone={onDone} />}
    </Sheet>
  )
}

const COLORS: [string, string][] = [
  ['Yellow', '#E8C547'],
  ['Brown', '#8A5A2B'],
  ['Green', '#6E8B3D'],
  ['Black', '#222'],
  ['Red', '#C0392B'],
  ['White', '#EEE'],
]

export function DiaperSheet({ kid, onClose, onDone, entry }: SheetProps & { entry?: Entry }) {
  const d = entry?.details
  // An entry keeps the words it was saved with (Wet/Dirty for diapers, Pee/Poop for potty).
  const potty = entry ? ['Pee', 'Poop'].includes(d?.kind ?? '') || !!d?.where : isPotty(kid)
  const [kind, setKind] = useState(d?.kind ?? (potty ? 'Pee' : 'Wet'))
  const [where, setWhere] = useState(d?.where ?? 'In potty')
  const [color, setColor] = useState(d?.color ?? (potty ? 'Brown' : 'Yellow'))
  const [texture, setTexture] = useState(d?.texture ?? 'Soft')
  const [time, setTime] = useState(() => (entry ? hm(entry.start) : nowHm()))
  const [note, setNote] = useState(entry?.note ?? '')
  const poop = isPoop({ kind })

  const changeStage = async (stage: string) => {
    await db.kids.update(kid.id, { stage: stage as Stage })
    setKind(stage === 'Diaper' ? 'Wet' : 'Pee')
    setWhere('In potty')
  }
  const save = async () => {
    const details: Details = { kind }
    if (poop) Object.assign(details, { color, texture })
    if (potty) {
      details.where = where
      if (where === 'Accident') details.accident = true
    }
    await store(entry, { kid: kid.id, type: 'diaper', start: when(time, entry), details, note: note.trim() || undefined })
    onDone(entry ? 'Entry updated' : potty ? 'Potty saved' : 'Diaper saved')
  }
  return (
    <Sheet onClose={onClose}>
      <h2>{entry ? (potty ? 'Edit potty' : 'Edit diaper') : potty ? 'Log potty' : 'Log a diaper'}</h2>
      <Field label="Kind">
        <ChipRow options={potty ? ['Pee', 'Poop', 'Both'] : ['Wet', 'Dirty', 'Both']} value={kind} onChange={setKind} />
      </Field>
      {potty && (
        <Field label="Where">
          <ChipRow
            options={kid.stage === 'Training' || where === 'In diaper' ? ['In potty', 'Accident', 'In diaper'] : ['In potty', 'Accident']}
            value={where}
            onChange={setWhere}
          />
        </Field>
      )}
      {poop && (
        <>
          <Field label="Color">
            <ChipRow options={COLORS} value={color} onChange={setColor} />
          </Field>
          <Field label="Texture">
            <ChipRow options={['Runny', 'Soft', 'Firm', 'Hard']} value={texture} onChange={setTexture} />
          </Field>
          {['Black', 'Red', 'White'].includes(color) && <div className="hint">This color can be worth mentioning to your pediatrician, especially if it happens again.</div>}
        </>
      )}
      <TimeField value={time} onChange={setTime} />
      {!entry && (
        <Field label={`${kid.name} uses`}>
          <ChipRow options={['Diaper', 'Training', 'Potty']} value={kid.stage} onChange={changeStage} />
        </Field>
      )}
      <NoteField value={note} onChange={setNote} />
      <button className="save" onClick={save}>
        {entry ? 'Save changes' : 'Save'}
      </button>
      {entry && <DeleteEntry entry={entry} onDone={onDone} />}
    </Sheet>
  )
}

export function NoteSheet({ kid, onClose, onDone, entry }: SheetProps & { entry?: Entry }) {
  const [time, setTime] = useState(() => (entry ? hm(entry.start) : nowHm()))
  const [note, setNote] = useState(entry?.note ?? '')
  const save = async () => {
    if (!note.trim()) return document.getElementById('f-note')?.focus()
    await store(entry, { kid: kid.id, type: 'note', start: when(time, entry), details: {}, note: note.trim() })
    onDone(entry ? 'Note updated' : 'Note saved')
  }
  return (
    <Sheet onClose={onClose}>
      <h2>{entry ? 'Edit note' : 'Add a note'}</h2>
      <TimeField value={time} onChange={setTime} />
      <NoteField value={note} onChange={setNote} required />
      <button className="save" onClick={save}>
        {entry ? 'Save changes' : 'Save'}
      </button>
      {entry && <DeleteEntry entry={entry} onDone={onDone} />}
    </Sheet>
  )
}
