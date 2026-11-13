import { Icon, type IconName } from './Icons'
import type { KidInfo } from '../lib/types'

export type Tab = 'today' | 'food' | 'trends' | 'ai'

const TITLES: Record<Tab, string> = { today: 'Little Rhythm', food: 'Food', trends: 'Trends', ai: 'Insights' }

export function Header({ tab, now, onSettings }: { tab: Tab; now: number; onSettings: () => void }) {
  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="top">
      <h1>{TITLES[tab]}</h1>
      <div className="top-r">
        <div className="date">{date}</div>
        <button className="gear" onClick={onSettings} aria-label="Settings and backup">
          <Icon name="gear" />
        </button>
      </div>
    </div>
  )
}

export function KidPicker({ kids, current, onPick }: { kids: KidInfo[]; current: string; onPick: (id: string) => void }) {
  return (
    <div className="kids">
      {kids.map((k) => (
        <button key={k.id} className="kid" aria-pressed={k.id === current} onClick={() => onPick(k.id)}>
          <span className="avatar" style={{ background: k.color }}>
            {(k.name || '?')[0]}
          </span>
          <span>
            <b>{k.name}</b>
            <small>{k.age}</small>
          </span>
        </button>
      ))}
    </div>
  )
}

const TABS: [Tab, string, IconName][] = [
  ['today', 'Today', 'today'],
  ['food', 'Food', 'food'],
  ['trends', 'Trends', 'trends'],
  ['ai', 'Insights', 'ai'],
]

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      {TABS.map(([id, label, icon]) => (
        <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)}>
          <Icon name={icon} />
          {label}
        </button>
      ))}
    </nav>
  )
}
