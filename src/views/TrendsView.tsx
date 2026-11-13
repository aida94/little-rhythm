import { SleepBars, WeekChart, type Hidden, type Layer } from '../components/Charts'
import { Icon } from '../components/Icons'
import { bedtime, weekLabel, weekStats, weekSummary } from '../lib/entries'
import { isPotty } from '../lib/kids'
import type { Entry, KidInfo } from '../lib/types'

interface Props {
  kid: KidInfo
  mine: Entry[]
  now: number
  weekOff: number
  onWeek: (off: number) => void
  hidden: Hidden
  onToggle: (l: Layer) => void
}

/** How many weeks back the arrows go. */
const OLDEST = -4

export function TrendsView({ kid, mine, now, weekOff, onWeek, hidden, onToggle }: Props) {
  const days = weekStats(mine, now)
  const full = days.slice(0, 6)
  const avg = (f: (d: (typeof days)[number]) => number) => full.reduce((s, d) => s + f(d), 0) / (full.length || 1)
  const potty = isPotty(kid)
  const legend: [Layer, string, string, string][] = [
    ['sleep', 'Sleep', '', '--chart-sleep'],
    ['eat', 'Eat', '', '--chart-food'],
    ['poop', 'Poop', 'ln', '--poop'],
    ['wet', potty ? 'Pee' : 'Wet', 'ln thin', '--wet'],
  ]
  const go = (d: number) => {
    const n = weekOff + d
    if (n <= 0 && n >= OLDEST) onWeek(n)
  }

  return (
    <>
      <div className="card chart">
        <div className="chart-h">
          <h3>Overview</h3>
          <div className="wk">
            <button onClick={() => go(-1)} aria-label="Previous 7 days" aria-disabled={weekOff <= OLDEST}>
              <Icon name="prev" />
            </button>
            <span>{weekLabel(weekOff)}</span>
            <button onClick={() => go(1)} aria-label="Next 7 days" aria-disabled={weekOff >= 0}>
              <Icon name="next" />
            </button>
          </div>
        </div>
        <div className="sub">{weekSummary(mine, weekOff, now)}</div>
        <div className="legend" role="group" aria-label="Show or hide in chart">
          {legend.map(([id, label, cls, color]) => (
            <button key={id} aria-pressed={!hidden[id]} onClick={() => onToggle(id)}>
              <i className={cls} style={{ background: `var(${color})` }} />
              {label}
            </button>
          ))}
        </div>
        <WeekChart mine={mine} now={now} weekOff={weekOff} hidden={hidden} />
        <div className="disclaim">Milk shows as a light block, food as a darker line, poop and pee as lines. Overlaps are see-through. Tap a label above to hide or show it.</div>
      </div>

      <div className="card chart">
        <h3>Sleep per day</h3>
        <div className="sub">Hours, naps and night combined. Today is still running.</div>
        <SleepBars days={days} />
      </div>

      <div className="stats">
        <div>
          <small>Avg sleep / day</small>
          <b>{avg((d) => d.sleep).toFixed(1)}h</b>
        </div>
        <div>
          <small>Avg feeds / day</small>
          <b>{avg((d) => d.feeds).toFixed(1)}</b>
        </div>
        <div>
          <small>Avg {potty ? 'potty trips' : 'diapers'} / day</small>
          <b>{avg((d) => d.diapers).toFixed(1)}</b>
        </div>
        <div>
          <small>Usual bedtime</small>
          <b>{bedtime(mine).avg || '—'}</b>
        </div>
      </div>
    </>
  )
}
