import { useState } from 'react'
import { KidForm } from '../components/KidForm'
import { db } from '../lib/db'
import { draftProblem, draftToKid, newKidDraft, type KidDraft } from '../lib/kids'

/** First start: add the kids. Nothing is saved until "Start" is tapped. */
export function WelcomeView() {
  const [drafts, setDrafts] = useState<KidDraft[]>(() => [newKidDraft([])])
  const [problem, setProblem] = useState('')

  const update = (id: string, patch: Partial<KidDraft>) => {
    setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    setProblem('')
  }
  const start = async () => {
    const p = drafts.map(draftProblem).find(Boolean)
    if (p) return setProblem(p)
    await db.kids.bulkAdd(drafts.map(draftToKid))
  }

  return (
    <div className="phone">
      <div className="app welcome">
        <div className="welcome-h">
          <h1>Welcome to Little Rhythm</h1>
          <p>Track sleep, meals and potty for your kids. First, tell us who they are.</p>
        </div>
        {drafts.map((d) => (
          <KidForm key={d.id} draft={d} onChange={(p) => update(d.id, p)} onRemove={drafts.length > 1 ? () => setDrafts((ds) => ds.filter((x) => x.id !== d.id)) : undefined} />
        ))}
        <button className="btn2" onClick={() => setDrafts((ds) => [...ds, newKidDraft(ds)])}>
          + Add another child
        </button>
        {problem && (
          <div className="hint" role="alert">
            {problem}
          </div>
        )}
        <button className="save" onClick={start}>
          Start
        </button>
        <p className="disclaim">Everything stays in this browser on this device. You can change this later in Settings.</p>
      </div>
    </div>
  )
}
