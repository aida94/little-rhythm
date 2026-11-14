import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { AiError, getAiSettings } from '../lib/ai'
import { DAYS, GROUPS, NUTRIENTS, keyNutrients, slotsFor, type GroupId, type NutrientId } from '../lib/food'
import { analyseFoodsAi, foodKey, getFactsCache, getMenuNote, localFacts, mergeFacts, planMenu, saveAiMenu, weekIntake } from '../lib/foodAi'
import { localEmoji } from '../lib/foodEmoji'
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
  onOpenSettings: () => void
  onToast: (msg: string) => void
}

const AMOUNT_SHORT: Record<string, string> = { None: 'none', 'A little': 'a little', Half: 'half', Most: 'most', All: 'all' }

export function FoodView({ kid, mine, menu, day, onDay, onEditSlot, onLogSlot, onOpenSettings, onToast }: Props) {
  const baby = kid.ageM < 12
  const plan = menu[kid.id]?.[day] ?? {}
  const isToday = day === todayIdx()
  // Days earlier in this week (Mon … yesterday) are done: their meals can be seen but not changed.
  const isPast = day < todayIdx()
  const aiOn = useLiveQuery(async () => !!(await getAiSettings())?.apiKey, []) ?? false
  const cache = useLiveQuery(getFactsCache, [])
  const note = useLiveQuery(() => getMenuNote(kid.id), [kid.id])

  // Food facts: from the AI when it has seen the food, else from the built-in list.
  const facts = (food: string) => mergeFacts(cache?.[foodKey(food)], localFacts(food))
  const days = weekIntake(mine, facts)
  const foods = days.flatMap((d) => d.foods)
  const missing = [...new Set(foods.map((f) => foodKey(f.text)))].filter((k) => k && cache && !(k in cache))
  const missingKey = missing.join('|')
  const allByAi = foods.length > 0 && missing.length === 0 && !!cache

  // Ask the AI about new foods once, in the background.
  const [checking, setChecking] = useState(0)
  const tried = useRef(new Set<string>())
  useEffect(() => {
    if (!aiOn || !missingKey) return
    const todo = missingKey.split('|').filter((k) => !tried.current.has(k))
    if (!todo.length) return
    todo.forEach((k) => tried.current.add(k))
    setChecking(todo.length)
    analyseFoodsAi(todo)
      .catch(() => {}) // the built-in list stays in use
      .finally(() => setChecking(0))
  }, [aiOn, missingKey])

  const keys = keyNutrients(kid)
  const [picked, setPicked] = useState<{ n: NutrientId; i: number } | null>(null)
  const rows = keys
    .map((n) => {
      const hit = days.map((d) => d.nutrients.has(n))
      return { n, hit, c: hit.filter(Boolean).length }
    })
    .sort((a, b) => a.c - b.c)
  const loggedDays = days.filter((d) => d.foods.length).length
  const per = Object.fromEntries(GROUPS.map(([g]) => [g, days.reduce((s, d) => s + d.groups[g], 0) / Math.max(1, loggedDays)])) as Record<GroupId, number>

  // Weekly menu by AI
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState('')
  const makePlan = async () => {
    if (!confirm(`Replace ${kid.name}'s weekly menu with a new one from the AI?`)) return
    setPlanning(true)
    setPlanError('')
    try {
      const lowNutrients = rows.filter((r) => r.c < 3).map((r) => NUTRIENTS[r.n].name)
      const lowGroups = baby ? [] : GROUPS.filter(([g, , target]) => loggedDays && per[g] < target * 0.6).map(([, label]) => label)
      const { days: week, why } = await planMenu(kid, mine, { lowNutrients, lowGroups })
      await saveAiMenu(menu, kid.id, week, why)
      onToast('New weekly menu ready')
    } catch (e) {
      setPlanError(e instanceof AiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setPlanning(false)
    }
  }

  const source = !foods.length ? '' : checking ? `AI is checking ${checking} new ${checking === 1 ? 'food' : 'foods'}…` : allByAi ? 'Checked by AI' : 'Estimated from a built-in food list'
  const dayName = (i: number) => (i === 6 ? 'Today' : i === 5 ? 'Yesterday' : new Date(days[i].date).toLocaleDateString(undefined, { weekday: 'short' }))

  return (
    <>
      <div className="card">
        <div className="chart-h">
          <h3>Weekly menu</h3>
          <span className="tag">{note ? 'By AI' : baby ? 'Solids' : 'Food'}</span>
        </div>
        <div className="days">
          {DAYS.map((d, i) => (
            <button key={d} aria-pressed={i === day} className={i === todayIdx() ? 'is-today' : i < todayIdx() ? 'is-past' : undefined} onClick={() => onDay(i)}>
              {d}
            </button>
          ))}
        </div>
        <div className="slots">
          {slotsFor(kid).map((sl) => {
            const v = plan[sl] || ''
            return (
              <div className="slot" key={sl}>
                {isPast ? (
                  <div className="slot-main past">
                    <small>{sl}</small>
                    <b>{v || '—'}</b>
                  </div>
                ) : (
                  <button className="slot-main" onClick={() => onEditSlot(sl)}>
                    <small>{sl}</small>
                    <b>{v || <span className="add">+ Add food</span>}</b>
                  </button>
                )}
                {isToday && v && (
                  <button className="slot-log" onClick={() => onLogSlot(sl)}>
                    Log
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {isPast && <div className="disclaim">This day has passed, so its meals can't be changed.</div>}
        {note?.why && <div className="menu-why">{note.why}</div>}
        {aiOn ? (
          <button className="btn2 menu-ai" onClick={makePlan} disabled={planning}>
            {planning ? 'The AI is planning the week…' : note ? 'Plan a new week with AI' : `Plan ${kid.name}'s week with AI`}
          </button>
        ) : (
          <button className="menu-connect" onClick={onOpenSettings}>
            Connect AI in Settings to plan the week from what {kid.name} eats
          </button>
        )}
        {planError && (
          <div className="hint" role="alert">
            {planError}
          </div>
        )}
        {note && (
          <div className="disclaim">
            Planned {new Date(note.createdAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} from {kid.name}'s age and the last 14
            days of meals. Tap a meal from today on to change it.
          </div>
        )}
        {baby && <div className="disclaim">Under 1 year, milk is still the main food. Solids are for practice and for iron.</div>}
      </div>

      <div className="card">
        <h3>What {kid.name} ate this week</h3>
        <div className="sub">
          {foods.length ? `${foods.length} ${foods.length === 1 ? 'meal' : 'meals'} logged in the last 7 days` : 'From the meals you log'}
          {source && ` · ${source}`}
        </div>
        {foods.length ? (
          <>
            <div className="ate">
              {days
                .map((d, i) => ({ d, i }))
                .filter(({ d }) => d.foods.length)
                .reverse()
                .map(({ d, i }) => (
                  <div className="ate-day" key={d.date}>
                    <small>{dayName(i)}</small>
                    <div className="emoji-row">
                      {d.foods.map((f, j) => {
                        const name = `${f.text || f.when}${f.amount ? `, ${AMOUNT_SHORT[f.amount] ?? f.amount} eaten` : ''}`
                        return (
                          <span className={f.amount === 'None' ? 'refused' : undefined} key={j} role="img" aria-label={name} title={name}>
                            {f.emoji || localEmoji(f.text) || '🍽️'}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
            </div>
            {foods.some((f) => f.amount === 'None') && <div className="disclaim">Greyed out: not eaten.</div>}
            <div className="sub nut-sub">Key nutrients for {kid.age}</div>
            <div className="disclaim">Each square is a day. Tap one to see which foods gave it.</div>
            {rows.map((r) => {
              const [cls, label] = r.c >= 5 ? ['good', 'Good'] : r.c >= 2 ? ['low', 'Low'] : ['miss', 'Missing']
              return (
                <div className="nut" key={r.n}>
                  <div className="nut-h">
                    <b>{NUTRIENTS[r.n].name}</b>
                    <span className={`pill ${cls}`}>{label}</span>
                  </div>
                  <div className="dots" role="group" aria-label={`${NUTRIENTS[r.n].name}: ${r.c} of 7 days. Tap a day to see the foods.`}>
                    {r.hit.map((x, i) => {
                      const open = picked?.n === r.n && picked.i === i
                      return (
                        <button
                          key={i}
                          className={`dot${x ? ' on' : ''}${open ? ' open' : ''}`}
                          aria-label={`${dayName(i)}: ${x ? `${NUTRIENTS[r.n].name} from ${days[i].sources[r.n]?.length ?? 0} ${(days[i].sources[r.n]?.length ?? 0) === 1 ? 'food' : 'foods'}` : 'none'}`}
                          aria-expanded={open}
                          onClick={() => setPicked(open ? null : { n: r.n, i })}
                        />
                      )
                    })}
                    <span>{r.c} of 7 days</span>
                  </div>
                  {picked?.n === r.n && <NutrientPop name={NUTRIENTS[r.n].name} day={dayName(picked.i)} foods={days[picked.i].sources[r.n] ?? []} kid={kid.name} onClose={() => setPicked(null)} />}
                  {r.c < 5 && <div className="try">Try: {NUTRIENTS[r.n].foods}</div>}
                </div>
              )
            })}
          </>
        ) : (
          <div className="empty">Log what {kid.name} eats, with how much, to see this.</div>
        )}
      </div>

      {!baby ? (
        <div className="card">
          <h3>Food groups</h3>
          <div className="sub">
            {loggedDays
              ? `Servings a day, from what ${kid.name} actually ate (${loggedDays} ${loggedDays === 1 ? 'day' : 'days'} logged), against a rough target for ${kid.age}`
              : `Servings a day against a rough target for ${kid.age}`}
          </div>
          {GROUPS.map(([g, label, target]) => {
            const v = per[g]
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
          {loggedDays > 0 && <div className="disclaim">Amounts count: "half" eaten is half a portion. Milk bottles count as dairy.</div>}
        </div>
      ) : (
        <div className="card">
          <h3>Variety</h3>
          <div className="sub">At this age, variety matters more than amounts</div>
          <div className="stats">
            <div>
              <small>Different foods this week</small>
              <b>{new Set(foods.map((f) => foodKey(f.text))).size}</b>
            </div>
            <div>
              <small>Food groups tried</small>
              <b>{GROUPS.filter(([g]) => days.some((d) => d.groups[g] > 0)).length} of 5</b>
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

/** What a tapped nutrient square means: the foods that gave it that day. */
function NutrientPop({ name, day, foods, kid, onClose }: { name: string; day: string; foods: { text: string; emoji?: string; amount?: string }[]; kid: string; onClose: () => void }) {
  return (
    <div className="nut-pop" role="status">
      <div className="nut-pop-h">
        <b>
          {day} · {name}
        </b>
        <button aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      {foods.length ? (
        <div className="emoji-row">
          {foods.map((f, i) => {
            const label = `${f.text}${f.amount ? `, ${AMOUNT_SHORT[f.amount] ?? f.amount} eaten` : ''}`
            return (
              <span key={i} role="img" aria-label={label} title={label}>
                {f.emoji || localEmoji(f.text) || '🍽️'}
              </span>
            )
          })}
        </div>
      ) : (
        <p>No food with {name.toLowerCase()} logged for {kid} this day.</p>
      )}
    </div>
  )
}
