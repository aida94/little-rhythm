import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Field } from '../components/ui'
import { AiError, DEFAULT_MODEL, clearAiSettings, getAiSettings, saveAiSettings, testAi } from '../lib/ai'

/** Settings section: the AI key, kept only on this device. */
export function AiSettingsField() {
  const saved = useLiveQuery(() => getAiSettings(), [])
  const [editing, setEditing] = useState(false)
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const hasKey = !!saved?.apiKey
  const startEdit = () => {
    setKey('')
    setModel(saved?.model && saved.model !== DEFAULT_MODEL ? saved.model : '')
    setStatus(null)
    setEditing(true)
  }
  const save = async () => {
    if (!key.trim()) return setStatus({ ok: false, text: 'Paste your API key first.' })
    const settings = { apiKey: key.trim(), model: model.trim() || DEFAULT_MODEL }
    setBusy(true)
    setStatus({ ok: true, text: 'Checking the key…' })
    try {
      await testAi(settings)
      await saveAiSettings(settings)
      setEditing(false)
      setStatus({ ok: true, text: 'Connected. The key is saved on this device.' })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof AiError ? e.message : 'Something went wrong.' })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!confirm('Remove the AI key from this device?')) return
    await clearAiSettings()
    setStatus(null)
  }

  return (
    <Field label="AI assistant">
      <div className="store">
        {hasKey && !editing ? (
          <>
            <b>AI connected.</b> The key is saved only in this browser and is not part of backups.
          </>
        ) : (
          <>
            Add your own AI API key to get insights and answers. The key stays in this browser. When you use AI, the last 14 days of logs are sent to the AI
            service without names.
          </>
        )}
      </div>
      {editing || !hasKey ? (
        <>
          <input
            type="password"
            value={key}
            placeholder="API key"
            aria-label="AI API key"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
          />
          <input type="text" value={model} aria-label="Model" placeholder="Model (optional)" spellCheck={false} onChange={(e) => setModel(e.target.value)} />
          <div className="btn-row">
            <button className="btn2" onClick={save} disabled={busy}>
              {busy ? 'Checking…' : 'Save key'}
            </button>
            {hasKey && (
              <button className="btn2" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="btn-row">
          <button className="btn2" onClick={startEdit}>
            Change key
          </button>
          <button className="btn2 danger" onClick={remove}>
            Remove key
          </button>
        </div>
      )}
      {status && <div className={status.ok ? 'ok-msg' : 'hint'}>{status.text}</div>}
    </Field>
  )
}
