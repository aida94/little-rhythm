import { bedtime, weekStats } from '../lib/entries'
import { AiPanel } from './AiPanel'
import { MIN, dayStart, dur } from '../lib/time'
import type { Entry, KidInfo } from '../lib/types'

interface Props {
  kid: KidInfo
  kids: KidInfo[]
  mine: Entry[]
  now: number
  onOpenSettings: () => void
}

/** Quick numbers from simple rules, then the AI section. */
export function InsightsView(props: Props) {
  return (
    <>
      <RuleInsights {...props} />
      <AiPanel {...props} />
    </>
  )
}

function RuleInsights({ kid, mine, now }: Props) {
  const w = weekStats(mine, now).slice(0, 6)
  const days = w.filter((d) => d.sleep > 0)
  if (days.length < 3)
    return (
      <div className="coming">
        <b>Log a few more days</b>
        This week's numbers appear once {kid.name} has at least 3 days of sleep logged.
        {days.length ? ` So far: ${days.length} ${days.length === 1 ? 'day' : 'days'}.` : ''}
      </div>
    )

  const avgSleep = days.reduce((s, d) => s + d.sleep, 0) / days.length
  const bt = bedtime(mine)
  const naps = mine.filter((e) => e.type === 'sleep' && e.details.kind === 'Nap' && e.end && e.start > dayStart(-6))
  const napAvg = naps.length ? naps.reduce((s, e) => s + (e.end! - e.start), 0) / naps.length : 0
  const target = kid.ageM < 12 ? [12, 15] : [11, 14]
  const list: { c: string; t: string; p: string }[] = [
    {
      c: 'var(--sleep)',
      t: `About ${avgSleep.toFixed(1)} hours of sleep a day`,
      p:
        avgSleep < target[0]
          ? `That is a little under the usual ${target[0]}–${target[1]}h for ${kid.age}. An earlier bedtime by 15–20 minutes is often the easiest fix.`
          : `That sits within the usual ${target[0]}–${target[1]}h range for ${kid.age}.`,
    },
  ]
  if (bt.avg)
    list.push({
      c: 'var(--sleep)',
      t: `Bedtime averages ${bt.avg}, give or take ${bt.spread} min`,
      p: (bt.spread ?? 0) > 15 ? 'Bedtime moves around quite a bit. A steadier time, with the same short routine, tends to help kids fall asleep faster.' : 'Bedtime is nice and steady this week.',
    })
  if (napAvg)
    list.push({
      c: 'var(--sleep)',
      t: `Naps last ${dur(napAvg)} on average`,
      p: kid.ageM < 12 && napAvg < 60 * MIN ? 'Short naps at this age often mean the awake time before the nap was a bit long or short. Try adjusting the wake window by 15 minutes.' : 'Nap length looks steady.',
    })
  const feeds = w.reduce((s, d) => s + d.feeds, 0) / w.length
  if (feeds)
    list.push({
      c: 'var(--feed)',
      t: `${feeds.toFixed(1)} ${kid.ageM < 12 ? 'feeds' : 'meals and snacks'} a day`,
      p: `Logged ${kid.ageM < 12 ? 'feeds' : 'meals and snacks'}, averaged over the last 6 full days.`,
    })

  return (
    <>
      <div className="sec-h">
        <h2>This week in numbers</h2>
      </div>
      {list.map((i) => (
        <div key={i.t} className="insight" style={{ '--c': i.c } as React.CSSProperties}>
          <b>{i.t}</b>
          <p>{i.p}</p>
        </div>
      ))}
    </>
  )
}
