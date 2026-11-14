import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Hidden, Layer } from './components/Charts'
import { Header, KidPicker, TabBar, type Tab } from './components/Chrome'
import { Icon } from './components/Icons'
import { db, getSetting } from './lib/db'
import { runningSleep } from './lib/entries'
import { fullMenu } from './lib/food'
import { withAge } from './lib/kids'
import { todayIdx } from './lib/time'
import type { Menu } from './lib/types'
import { useNow } from './lib/useNow'
import { DiaperSheet, FeedSheet, NoteSheet, SleepSheet, WakeSheet } from './sheets/EntrySheets'
import { MenuSheet, SaySheet, SettingsSheet } from './sheets/MoreSheets'
import { FoodView } from './views/FoodView'
import { InsightsView } from './views/InsightsView'
import { TodayView, type QuickAction } from './views/TodayView'
import { TrendsView } from './views/TrendsView'
import { WelcomeView } from './views/WelcomeView'

type SheetState =
  | { type: 'sleep' | 'wake' | 'diaper' | 'note' | 'say' | 'settings' }
  | { type: 'feed'; method?: string; food?: string }
  | { type: 'menu'; slot: string }
  | { type: 'edit'; id: string }

const KID_KEY = 'littlerhythm-kid'
const readKid = () => {
  try {
    return localStorage.getItem(KID_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function App() {
  const rawKids = useLiveQuery(() => db.kids.toArray(), [])
  const entries = useLiveQuery(() => db.entries.toArray(), [])
  const savedMenu = useLiveQuery(() => getSetting<Menu>('menu'), [])
  const now = useNow()

  const [tab, setTab] = useState<Tab>('today')
  const [kidId, setKidId] = useState(readKid)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [weekOff, setWeekOff] = useState(0)
  const [foodDay, setFoodDay] = useState(todayIdx)
  const [hidden, setHidden] = useState<Hidden>({})
  const scroller = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  // Oldest kid first; ages worked out for today.
  const kids = useMemo(() => (rawKids ?? []).map((k) => withAge(k, new Date(now))).sort((a, b) => a.birth.localeCompare(b.birth)), [rawKids, now])
  const kid = kids.find((k) => k.id === kidId) ?? kids[0]
  const mine = useMemo(() => (entries ?? []).filter((e) => e.kid === kid?.id), [entries, kid?.id])
  const menu = useMemo(() => fullMenu(savedMenu, kids), [savedMenu, kids])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }, [])
  const close = useCallback(() => setSheet(null), [])
  const done = useCallback(
    (msg: string) => {
      setSheet(null)
      flash(msg)
    },
    [flash],
  )
  const doneToToday = useCallback(
    (msg: string) => {
      done(msg)
      setTab('today')
    },
    [done],
  )

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [tab])

  if (!rawKids || !entries) return <div className="phone" />
  if (!kid) return <WelcomeView />

  const pickKid = (id: string) => {
    setKidId(id)
    try {
      localStorage.setItem(KID_KEY, id)
    } catch {
      /* private mode */
    }
  }
  const quick = (a: QuickAction) => setSheet({ type: a === 'sleep' && runningSleep(mine) ? 'wake' : a })
  const running = runningSleep(mine)
  const sheetProps = { kid, onClose: close, onDone: doneToToday }
  const editing = sheet?.type === 'edit' ? mine.find((e) => e.id === sheet.id) : undefined
  const otherRunning = editing ? runningSleep(mine.filter((e) => e.id !== editing.id)) : undefined

  return (
    <div className="phone">
      <div className="app" ref={scroller}>
        <Header tab={tab} now={now} onSettings={() => setSheet({ type: 'settings' })} />
        <KidPicker kids={kids} current={kid.id} onPick={pickKid} />
        {tab === 'today' && <TodayView kid={kid} mine={mine} now={now} onAction={quick} onWeek={() => setTab('trends')} onDelete={(id) => db.entries.delete(id).then(() => flash('Entry deleted'))} onEdit={(id) => setSheet({ type: 'edit', id })} />}
        {tab === 'food' && (
          <FoodView
            kid={kid}
            mine={mine}
            menu={menu}
            day={foodDay}
            onDay={setFoodDay}
            onEditSlot={(slot) => setSheet({ type: 'menu', slot })}
            onLogSlot={(slot) => {
              const v = menu[kid.id]?.[foodDay]?.[slot] ?? ''
              const baby = kid.ageM < 12
              setSheet({ type: 'feed', method: baby ? 'Solids' : 'Meal', food: baby ? v : `${slot}: ${v}` })
            }}
          />
        )}
        {tab === 'trends' && <TrendsView kid={kid} mine={mine} now={now} weekOff={weekOff} onWeek={setWeekOff} hidden={hidden} onToggle={(l: Layer) => setHidden((h) => ({ ...h, [l]: !h[l] }))} />}
        {tab === 'ai' && <InsightsView kid={kid} kids={kids} mine={mine} now={now} onOpenSettings={() => setSheet({ type: 'settings' })} />}
      </div>

      <TabBar tab={tab} onTab={setTab} />

      {tab === 'today' && !sheet && (
        <button className="fab" onClick={() => setSheet({ type: 'say' })} aria-label="Log by voice or text">
          <Icon name="mic" />
          <span>Say it</span>
        </button>
      )}

      {sheet?.type === 'sleep' && <SleepSheet {...sheetProps} mine={mine} running={running} />}
      {sheet?.type === 'wake' && running && <WakeSheet {...sheetProps} running={running} onAddEarlier={() => setSheet({ type: 'sleep' })} />}
      {sheet?.type === 'feed' && <FeedSheet {...sheetProps} initial={sheet} />}
      {sheet?.type === 'diaper' && <DiaperSheet {...sheetProps} />}
      {sheet?.type === 'note' && <NoteSheet {...sheetProps} />}
      {sheet?.type === 'say' && <SaySheet {...sheetProps} kids={kids} />}
      {sheet?.type === 'menu' && <MenuSheet kid={kid} onClose={close} onDone={done} menu={menu} day={foodDay} slot={sheet.slot} />}
      {editing?.type === 'sleep' && <SleepSheet key={editing.id} {...sheetProps} mine={mine} running={otherRunning} entry={editing} />}
      {editing?.type === 'feed' && <FeedSheet key={editing.id} {...sheetProps} entry={editing} />}
      {editing?.type === 'diaper' && <DiaperSheet key={editing.id} {...sheetProps} entry={editing} />}
      {editing?.type === 'note' && <NoteSheet key={editing.id} {...sheetProps} entry={editing} />}
      {sheet?.type === 'settings' && <SettingsSheet kids={kids} entries={entries} onClose={close} onDone={done} />}

      {toast && !sheet && <div className="toast">{toast}</div>}
    </div>
  )
}
