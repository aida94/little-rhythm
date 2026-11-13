import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type CSSProperties } from 'react'
import { AiError, getAiSettings } from '../lib/ai'
import { askAi, createInsights, getSavedInsights, type AiInsight } from '../lib/aiInsights'
import { D } from '../lib/time'
import type { Entry, KidInfo } from '../lib/types'

const AREA_COLOR: Record<AiInsight['area'], string> = {
  sleep: 'var(--sleep)',
  food: 'var(--feed)',
  potty: 'var(--diaper)',
  general: 'var(--note)',
}

const errorText = (e: unknown) => (e instanceof AiError ? e.message : 'Something went wrong. Try again.')

interface Props {
  kid: KidInfo
  kids: KidInfo[]
  mine: Entry[]
  now: number
  onOpenSettings: () => void
}

/** AI insights and questions for one child. Uses the key from Settings. */
export function AiPanel({ kid, kids, mine, now, onOpenSettings }: Props) {
  // null = no key saved; undefined = still loading
  const settings = useLiveQuery(async () => (await getAiSettings()) ?? null, [])
  const saved = useLiveQuery(() => getSavedInsights(kid.id), [kid.id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<{ kidId: string; q: string; a: string } | null>(null)
  const [asking, setAsking] = useState(false)

  const recent = mine.some((e) => e.start > now - 14 * D)

  if (settings === undefined) return null
  if (!settings?.apiKey)
    return (
      <div className="coming">
        <b>AI assistant</b>
        Get a weekly summary and ask questions about {kid.name}'s sleep and eating. Add your AI API key in Settings to turn it on.
        <button className="btn2 ai-connect" onClick={onOpenSettings}>
          Add API key
        </button>
      </div>
    )

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      await createInsights(kid, mine, kids)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const ask = async () => {
    const q = question.trim()
    if (!q) return
    setAsking(true)
    setError('')
    try {
      const a = await askAi(q, kid, mine, kids)
      setAnswer({ kidId: kid.id, q, a })
      setQuestion('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setAsking(false)
    }
  }

  const when = saved ? new Date(saved.createdAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <>
      <div className="sec-h">
        <h2>AI insights</h2>
        {saved && <span>Made {when}</span>}
      </div>

      {saved && (
        <>
          {saved.result.summary && <div className="ai-summary">{saved.result.summary}</div>}
          {saved.result.seeDoctor && (
            <div className="ai-doctor">
              <b>Worth asking your pediatrician</b>
              {saved.result.seeDoctor}
            </div>
          )}
          {saved.result.insights.map((i, n) => (
            <div key={n} className="insight" style={{ '--c': AREA_COLOR[i.area] } as CSSProperties}>
              <b>{i.title}</b>
              <p>{i.detail}</p>
              {i.try && (
                <p className="ai-try">
                  <strong>Try:</strong> {i.try}
                </p>
              )}
            </div>
          ))}
        </>
      )}

      <button className="save" onClick={generate} disabled={busy || !recent}>
        {busy ? 'Looking at the last 14 days…' : saved ? 'Refresh insights' : `Create insights for ${kid.name}`}
      </button>
      {!recent && <div className="disclaim">Log a few days first. The AI looks at the last 14 days.</div>}

      <div className="chat">
        <label htmlFor="ai-q" className="ai-q-label">
          Ask about {kid.name}
        </label>
        {answer?.kidId === kid.id && (
          <>
            <div className="bubble me">{answer.q}</div>
            <div className="bubble ai">{answer.a}</div>
          </>
        )}
        <textarea
          id="ai-q"
          value={question}
          placeholder={`Why is ${kid.name} waking up early?`}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask()
            }
          }}
        />
        <button className="btn2" onClick={ask} disabled={asking || !question.trim()}>
          {asking ? 'Thinking…' : 'Ask'}
        </button>
      </div>

      {error && (
        <div className="hint" role="alert">
          {error}
        </div>
      )}
      <div className="disclaim">
        Uses the last 14 days of {kid.name}'s logs, sent to the AI service without names. General guidance, not medical advice.
      </div>
    </>
  )
}
