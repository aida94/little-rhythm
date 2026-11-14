import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { KidForm } from '../components/KidForm'
import { Field, Sheet } from '../components/ui'
import { EntryRow } from '../views/TodayView'
import { downloadBackup, readBackup, restoreBackup, wipeAll } from '../lib/backup'
import { db, getSetting, removeKid, saveMenu } from '../lib/db'
import { describeEntry } from '../lib/entries'
import { AiError, getAiSettings } from '../lib/ai'
import { parseSayAi } from '../lib/aiSay'
import { improveEmojiLater, localEmoji } from '../lib/foodEmoji'
import { DAYS, NUTRIENTS, keyNutrients } from '../lib/food'
import { draftProblem, draftToKid, newKidDraft, type KidDraft } from '../lib/kids'
import { parseSay, type ParsedEntry } from '../lib/say'
import { sampleEntries } from '../lib/seed'
import { dayStart, hm, uid } from '../lib/time'
import type { Entry, KidInfo, Menu } from '../lib/types'
import { AiSettingsField } from './AiSettings'
import type { SheetProps } from './EntrySheets'

export function MenuSheet({ kid, onClose, onDone, menu, day, slot }: SheetProps & { menu: Menu; day: number; slot: string }) {
  const [food, setFood] = useState(menu[kid.id]?.[day]?.[slot] ?? '')
  const ideas = keyNutrients(kid)
    .map((n) => NUTRIENTS[n].foods.split(', ')[0])
    .filter((f) => !f.includes('.'))
  const save = async () => {
    const next: Menu = structuredClone(menu)
    next[kid.id][day] = { ...next[kid.id][day], [slot]: food.trim() }
    await saveMenu(next)
    onDone('Menu updated')
  }
  return (
    <Sheet onClose={onClose}>
      <h2>
        {slot} · {DAYS[day]}
      </h2>
      <Field label={`What will ${kid.name} eat?`} htmlFor="f-food">
        <input type="text" id="f-food" value={food} placeholder={kid.ageM < 12 ? 'Mashed lentils' : 'Chicken and rice'} onChange={(e) => setFood(e.target.value)} />
      </Field>
      <Field label="Ideas for this week">
        <div className="chips">
          {ideas.map((f) => (
            <button key={f} className="chip" onClick={() => setFood((cur) => (cur ? `${cur} and ${f}` : f))}>
              {f}
            </button>
          ))}
        </div>
      </Field>
      <button className="save" onClick={save}>
        Save
      </button>
    </Sheet>
  )
}

/** Type or dictate a sentence; preview the entries it becomes; add them.
 *  With AI connected, the AI reads the sentence. Otherwise (or if the AI fails) simple rules do. */
export function SaySheet({ kid, kids, onClose, onDone }: SheetProps & { kids: KidInfo[] }) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const [now] = useState(Date.now)
  const ai = useLiveQuery(async () => !!(await getAiSettings())?.apiKey, [])
  const [aiRead, setAiRead] = useState<{ text: string; entries: ParsedEntry[] } | null>(null)
  const [reading, setReading] = useState(false)
  const [aiError, setAiError] = useState<{ text: string; message: string } | null>(null)
  const [removed, setRemoved] = useState<{ text: string; ids: string[] }>({ text: '', ids: [] })

  const clean = text.trim()
  const aiFresh = aiRead && aiRead.text === clean ? aiRead.entries : null
  const aiFailed = aiError && aiError.text === clean ? aiError.message : ''
  // Rules are used when there is no AI, or when the AI failed for this exact text.
  const useRules = !ai || !!aiFailed
  // Stable ids (by position) so leaving one out survives re-renders; real ids are given on save.
  const ruled = useMemo(() => (clean ? parseSay(clean, kids, kid, now).map((e, i) => ({ ...e, id: `r${i}` })) : []), [clean, kids, kid, now])
  const all = !clean ? [] : (aiFresh ?? (useRules ? ruled : []))
  const gone = removed.text === clean ? removed.ids : []
  const parsed = all.filter((e) => !gone.includes(e.id))
  const needsReading = !!ai && !!clean && !aiFresh && !aiFailed

  const other = kids.find((k) => k.id !== kid.id)
  const placeholder = `${kid.name} had a few bites of pasta for lunch, then napped from 2 until 3.${other ? ` ${other.name} had a 150 ml bottle at 4.` : ''}`
  const read = async () => {
    setReading(true)
    try {
      const entries = await parseSayAi(clean, kids, kid)
      setAiRead({ text: clean, entries })
    } catch (e) {
      setAiError({ text: clean, message: e instanceof AiError ? e.message : 'The AI could not read this.' })
    } finally {
      setReading(false)
    }
  }
  const save = async () => {
    if (needsReading) return read()
    if (!parsed.length) return ref.current?.focus()
    const later: string[] = []
    const rows = parsed.map(({ said: _said, ...e }) => {
      const row = { ...e, id: uid(), details: { ...e.details } }
      if (row.type === 'feed' && row.details.food && !row.details.emoji) {
        const emoji = localEmoji(row.details.food)
        if (emoji) row.details.emoji = emoji
        later.push(row.id) // the AI may find better emoji afterwards
      }
      return row
    })
    await db.entries.bulkAdd(rows)
    later.forEach((id) => void improveEmojiLater(id))
    onDone(parsed.length === 1 ? 'Added to the log' : `Added ${parsed.length} entries`)
  }
  const source = aiFresh ? 'Read by AI' : useRules && parsed.length ? 'Read by simple rules' : ''
  return (
    <Sheet onClose={onClose}>
      <h2>Tell me what happened</h2>
      <Field label="Type or use the mic on your keyboard" htmlFor="f-say">
        <textarea id="f-say" ref={ref} autoFocus value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="disclaim">
        Say several things at once, in your own words: sleep, food, bottles, potty or diapers, and notes{other ? ', for any of your kids' : ''}. Times like
        "at 2", "this morning" or "yesterday" work. You can check everything before it is added.
      </div>
      <Field label={source ? `Will be added · ${source}` : 'Will be added'}>
        <div className="timeline say-prev">
          {parsed.length ? (
            parsed.map((e) => {
              const who = kids.find((k) => k.id === e.kid)
              const yesterday = e.start < dayStart(0) ? (e.start < dayStart(-1) ? new Date(e.start).toLocaleDateString(undefined, { weekday: 'short' }) + ' ' : 'Yesterday ') : ''
              return <PreviewRow key={e.id} e={e} now={now} who={who?.name ?? ''} prefix={yesterday} onRemove={() => setRemoved({ text: clean, ids: [...gone, e.id] })} />
            })
          ) : (
            <div className="empty">
              {reading
                ? 'The AI is reading your message…'
                : needsReading
                  ? 'Tap "Read with AI" to see the entries before they are added.'
                  : clean && aiFresh
                    ? 'The AI found nothing to log. Try saying it another way.'
                    : 'Your entries will appear here before they are added.'}
            </div>
          )}
        </div>
      </Field>
      {aiFailed && (
        <div className="hint" role="alert">
          {aiFailed} The simple rules were used instead.
        </div>
      )}
      {aiFresh && <div className="disclaim">Sent to the AI service without names. Check the entries, then add them.</div>}
      {ai === false && <div className="disclaim">Connect an AI service in Settings to understand longer, freer sentences.</div>}
      <button className="save" onClick={save} disabled={reading}>
        {reading ? 'Reading…' : needsReading ? 'Read with AI' : 'Add to log'}
      </button>
    </Sheet>
  )
}

/** Preview line: kid name on the left; sleep shows its own times, other entries get the start time in front. */
function PreviewRow({ e, now, who, prefix, onRemove }: { e: Entry; now: number; who: string; prefix: string; onRemove: () => void }) {
  const d = describeEntry(e, now)
  const det = e.type === 'sleep' ? (prefix ? prefix.trim() + ' · ' : '') + d.det : prefix + hm(e.start) + (d.det ? ' · ' + d.det : '')
  return (
    <EntryRow
      e={e}
      now={now}
      time={who}
      det={det}
      action={
        <button className="prev-x" aria-label="Leave this one out" onClick={onRemove}>
          ✕
        </button>
      }
    />
  )
}

export function SettingsSheet({ kids, entries, onClose, onDone }: Omit<SheetProps, 'kid'> & { kids: KidInfo[]; entries: Entry[] }) {
  const [drafts, setDrafts] = useState<KidDraft[]>(() => kids.map((k) => ({ id: k.id, name: k.name, gender: k.gender, birth: k.birth, color: k.color })))
  const [problem, setProblem] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const lastBackup = useLiveQuery(() => getSetting<number>('lastBackup'), [])
  const n = entries.length
  const samples = entries.filter((e) => e.sample).length

  const update = (id: string, patch: Partial<KidDraft>) => {
    setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    setProblem('')
  }
  const remove = async (d: KidDraft) => {
    if (!d.isNew) {
      const count = entries.filter((e) => e.kid === d.id).length
      const name = kids.find((k) => k.id === d.id)?.name ?? d.name
      if (!confirm(`Remove ${name}${count ? ` and ${count} logged ${count === 1 ? 'entry' : 'entries'}` : ''} from this device? This cannot be undone.`)) return
      await removeKid(d.id)
    }
    setDrafts((ds) => ds.filter((x) => x.id !== d.id))
  }
  const saveKids = async () => {
    const p = drafts.map(draftProblem).find(Boolean)
    if (p) return setProblem(p)
    await db.transaction('rw', db.kids, async () => {
      for (const d of drafts) {
        const { id, name, gender, birth, color } = draftToKid(d)
        if (d.isNew) await db.kids.add({ id, name, gender, birth, color })
        else await db.kids.update(id, { name, gender, birth })
      }
    })
    onDone('Saved')
  }
  const restore = async (file?: File) => {
    if (!file) return
    try {
      const b = await readBackup(file)
      if (!confirm(`Replace the data on this device with this backup (${b.entries.length} entries)?`)) return
      await restoreBackup(b)
      onDone('Backup restored')
    } catch {
      onDone('That file is not a Little Rhythm backup')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Settings</h2>
      <Field label="Kids">
        <div className="kid-list">
          {drafts.map((d) => (
            <KidForm key={d.id} draft={d} onChange={(p) => update(d.id, p)} onRemove={drafts.length > 1 ? () => remove(d) : undefined} />
          ))}
        </div>
      </Field>
      <button className="btn2" onClick={() => setDrafts((ds) => [...ds, newKidDraft(ds)])}>
        + Add a child
      </button>
      {problem && (
        <div className="hint" role="alert">
          {problem}
        </div>
      )}
      <button className="save" onClick={saveKids}>
        Save kids
      </button>
      <AiSettingsField />
      <Field label="Your data" className="section">
        <div className="store">
          <b>
            {n} {n === 1 ? 'entry' : 'entries'}
          </b>
          {samples ? ` (${samples} sample)` : ''}, saved only in this browser on this device. Nothing is sent anywhere.{' '}
          {lastBackup ? `Last backup: ${new Date(lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.` : 'No backup yet.'}
        </div>
        <div className="btn-row">
          <button className="btn2" onClick={() => downloadBackup().then(() => onDone('Backup downloaded'))}>
            Download backup
          </button>
          <button className="btn2" onClick={() => fileRef.current?.click()}>
            Restore backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </Field>
      <Field label="Try it out" className="section">
        <div className="btn-row">
          {samples ? (
            <button className="btn2" onClick={() => db.entries.bulkDelete(entries.filter((e) => e.sample).map((e) => e.id)).then(() => onDone('Sample data removed'))}>
              Remove sample data
            </button>
          ) : (
            <button className="btn2" onClick={() => db.entries.bulkAdd(sampleEntries(kids)).then(() => onDone('Sample data added'))}>
              Add sample data
            </button>
          )}
          <button
            className="btn2 danger"
            onClick={() => {
              if (confirm('Delete all entries, the menu and settings from this device? This cannot be undone. Download a backup first if you want to keep them.')) wipeAll()
            }}
          >
            Delete all data
          </button>
        </div>
      </Field>
    </Sheet>
  )
}
