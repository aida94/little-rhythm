import { TodayStrip } from '../components/Charts'
import { Icon } from '../components/Icons'
import { SwipeToDelete } from '../components/SwipeToDelete'
import { describeEntry, feedEnd, lastFinishedSleep, lastOf, runningSleep } from '../lib/entries'
import { isPotty } from '../lib/kids'
import { dayStart, dur, hm } from '../lib/time'
import type { Entry, KidInfo } from '../lib/types'

export type QuickAction = 'sleep' | 'earlierSleep' | 'feed' | 'diaper' | 'note'

interface Props {
  kid: KidInfo
  mine: Entry[]
  now: number
  onAction: (a: QuickAction) => void
  onWeek: () => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}

export function TodayView({ kid, mine, now, onAction, onWeek, onDelete, onEdit }: Props) {
  const running = runningSleep(mine)
  const lastSleep = lastFinishedSleep(mine)
  const lastFeed = lastOf(mine, 'feed')
  const lastToilet = lastOf(mine, 'diaper')
  const potty = isPotty(kid)
  const t0 = dayStart(0)
  const items = mine
    .filter((e) => e.start >= t0 || (e.type === 'sleep' && !e.end) || (e.end && e.end >= t0))
    .sort((a, b) => b.start - a.start)

  return (
    <>
      <div className="status">
        {running ? (
          <div className="status-main">
            <span className="big" style={{ color: 'var(--sleep)' }}>
              {dur(now - running.start)}
            </span>
            <span className="lbl">asleep since {hm(running.start)}</span>
            <button className="status-link" onClick={() => onAction('earlierSleep')}>
              + Add an earlier sleep
            </button>
          </div>
        ) : (
          <div className="status-main">
            <span className="big">{lastSleep?.end ? dur(now - lastSleep.end) : '—'}</span>
            <span className="lbl">awake{lastSleep?.end ? ` since ${hm(lastSleep.end)}` : ''}</span>
          </div>
        )}
        <div className="since">
          <div>
            <small>Last feed</small>
            <b>{!lastFeed ? '—' : now < feedEnd(lastFeed) ? 'now' : dur(now - feedEnd(lastFeed))}</b>
          </div>
          <div>
            <small>Last {potty ? 'potty' : 'diaper'}</small>
            <b>{lastToilet ? dur(now - lastToilet.start) : '—'}</b>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className={`act sleep ${running ? 'on' : ''}`} onClick={() => onAction('sleep')}>
          <Icon name="sleep" />
          {running ? 'Wake up' : 'Sleep'}
        </button>
        <button className="act feed" onClick={() => onAction('feed')}>
          <Icon name="feed" />
          Feed
        </button>
        <button className="act diaper" onClick={() => onAction('diaper')}>
          <Icon name="diaper" />
          {potty ? 'Potty' : 'Diaper'}
        </button>
        <button className="act note" onClick={() => onAction('note')}>
          <Icon name="note" />
          Note
        </button>
      </div>

      <TodayStrip mine={mine} now={now} onOpen={onWeek} />

      <div className="sec-h">
        <h2>{kid.name}'s day</h2>
        <span>
          {items.length} {items.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      <div className="timeline">
        {items.length ? (
          items.map((e) => (
            <SwipeToDelete key={e.id} onDelete={() => onDelete(e.id)}>
              <EntryRow e={e} now={now} time={hm(e.start)} onOpen={() => onEdit(e.id)} />
            </SwipeToDelete>
          ))
        ) : (
          <div className="empty">Nothing logged yet today. Tap a button above.</div>
        )}
      </div>
      {items.length > 0 && <div className="disclaim">Tap an entry to change it. Swipe left to delete.</div>}
    </>
  )
}

export function EntryRow({
  e,
  now,
  time,
  det,
  action,
  onOpen,
}: {
  e: Entry
  now: number
  time: string
  det?: string
  action?: React.ReactNode
  /** Makes the row tappable, e.g. to edit the entry. */
  onOpen?: () => void
}) {
  const d = describeEntry(e, now)
  const detail = det ?? d.det
  const open = onOpen
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': `Edit ${d.what} at ${time}`,
        onClick: onOpen,
        onKeyDown: (ev: React.KeyboardEvent) => {
          if (ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault()
            onOpen()
          }
        },
      }
    : {}
  return (
    <div className={`item${onOpen ? ' tap' : ''}`} {...open}>
      <time>{time}</time>
      <span className={`ic ${e.type}`}>
        <Icon name={e.type} />
      </span>
      <div>
        <div className="what">{d.what}</div>
        {detail && <div className="det">{detail}</div>}
        {e.note && <div className="nt">{e.note}</div>}
      </div>
      {action ?? <span />}
    </div>
  )
}
