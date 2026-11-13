import { DAYS, GROUPS, NUTRIENTS, analyse, keyNutrients, slotsFor, weekFood, type GroupId } from '../lib/food'
import { todayIdx } from '../lib/time'
import type { Entry, KidInfo, Menu } from '../lib/types'

interface Props {
  kid: KidInfo
  mine: Entry[]
  menu: Menu
  day: number
  onDay: (d: number) => void
  onEditSlot: (slot: string) => void
  onLogSlot: (slot: string) => void
}

export function FoodView({ kid, mine, menu, day, onDay, onEditSlot, onLogSlot }: Props) {
  const baby = kid.ageM < 12
  const plan = menu[kid.id]?.[day] ?? {}
  const isToday = day === todayIdx()
  const days = weekFood(mine)
  const keys = keyNutrients(kid)
  const rows = keys
    .map((n) => {
      const hit = days.map((fs) => fs.some((f) => analyse(f).some(([, ns]) => ns.includes(n))))
      return { n, hit, c: hit.filter(Boolean).length }
    })
    .sort((a, b) => a.c - b.c)
  const logged = days.flat().length
  const per = Object.fromEntries(GROUPS.map(([g]) => [g, 0])) as Record<GroupId, number>
  days.flat().forEach((f) => analyse(f).forEach(([g]) => per[g]++))

  return (
    <>
      <div className="card">
        <div className="chart-h">
          <h3>Weekly menu</h3>
          <span className="tag">{baby ? 'Solids' : 'Meals'}</span>
        </div>
        <div className="days">
          {DAYS.map((d, i) => (
            <button key={d} aria-pressed={i === day} className={i === todayIdx() ? 'is-today' : undefined} onClick={() => onDay(i)}>
              {d}
            </button>
          ))}
        </div>
        <div className="slots">
          {slotsFor(kid).map((sl) => {
            const v = plan[sl] || ''
            return (
              <div className="slot" key={sl}>
                <button className="slot-main" onClick={() => onEditSlot(sl)}>
                  <small>{sl}</small>
                  <b>{v || <span className="add">+ Add food</span>}</b>
                </button>
                {isToday && v && (
                  <button className="slot-log" onClick={() => onLogSlot(sl)}>
                    Log
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {baby && <div className="disclaim">Under 1 year, milk is still the main food. Solids are for practice and for iron.</div>}
      </div>

      <div className="card">
        <h3>What {kid.name} ate this week</h3>
        <div className="sub">Key nutrients for {kid.age}, from the meals you logged in the last 7 days</div>
        {logged ? (
          rows.map((r) => {
            const [cls, label] = r.c >= 5 ? ['good', 'Good'] : r.c >= 2 ? ['low', 'Low'] : ['miss', 'Missing']
            return (
              <div className="nut" key={r.n}>
                <div className="nut-h">
                  <b>{NUTRIENTS[r.n].name}</b>
                  <span className={`pill ${cls}`}>{label}</span>
                </div>
                <div className="dots" aria-label={`${r.c} of 7 days`}>
                  {r.hit.map((x, i) => (
                    <i key={i} className={x ? 'on' : ''} title={DAYS[(todayIdx() + 1 + i) % 7]} />
                  ))}
                  <span>{r.c} of 7 days</span>
                </div>
                {r.c < 5 && <div className="try">Try: {NUTRIENTS[r.n].foods}</div>}
              </div>
            )
          })
        ) : (
          <div className="empty">Log a meal with what was eaten to see this.</div>
        )}
      </div>

      {!baby ? (
        <div className="card">
          <h3>Food groups</h3>
          <div className="sub">Servings a day on average, against a rough target for {kid.age}</div>
          {GROUPS.map(([g, label, target]) => {
            const v = per[g] / 7
            return (
              <div className="grp" key={g}>
                <span>{label}</span>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, (v / target) * 100)}%` }} />
                </div>
                <b>
                  {v.toFixed(1)}
                  <small> / {target}</small>
                </b>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <h3>Variety</h3>
          <div className="sub">At this age, variety matters more than amounts</div>
          <div className="stats">
            <div>
              <small>Different foods this week</small>
              <b>{new Set(days.flat().map((f) => f.toLowerCase())).size}</b>
            </div>
            <div>
              <small>Food groups tried</small>
              <b>{GROUPS.filter(([g]) => per[g]).length} of 5</b>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Most important for {kid.age}</h3>
        <div className="sub">General guidance, not medical advice. Your pediatrician knows {kid.name} best.</div>
        {keys.map((n) => (
          <div className="kn" key={n}>
            <b>{NUTRIENTS[n].name}</b>
            <p>{NUTRIENTS[n].why}</p>
            <p className="src">{NUTRIENTS[n].foods}</p>
          </div>
        ))}
        <div className="safe">
          <b>Safe eating at {kid.age}</b>
          <p>
            {baby
              ? "No honey before 1 year. Cow's milk only in food, not as a main drink, until 1 year. Serve soft purées or mashed foods."
              : 'Cut round foods like grapes and cherry tomatoes into quarters. No whole nuts or popcorn before 4 years. Always eat sitting down.'}
          </p>
        </div>
      </div>
    </>
  )
}
