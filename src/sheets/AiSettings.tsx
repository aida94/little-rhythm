import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Field } from '../components/ui'
import { AiError, baseUrlProblem, clearAiSettings, getAiSettings, normalizeBaseUrl, saveAiSettings, testAi } from '../lib/ai'

/** Settings section: the AI service address, key and model, kept only on this device. */
export function AiSettingsField() {
  const saved = useLiveQuery(() => getAiSettings(), [])
  const [editing, setEditing] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const hasKey = !!saved?.apiKey
  const startEdit = () => {
    setBaseUrl(saved?.baseUrl ?? '')
    setKey('')
    setModel(saved?.baseUrl ? (saved?.model ?? '') : '')
    setStatus(null)
    setEditing(true)
  }
  const save = async () => {
    const urlProblem = baseUrlProblem(baseUrl)
    if (urlProblem) return setStatus({ ok: false, text: urlProblem })
    if (!key.trim()) return setStatus({ ok: false, text: 'Paste your API key.' })
    if (!model.trim()) return setStatus({ ok: false, text: 'Add the model name.' })
    const settings = { baseUrl: normalizeBaseUrl(baseUrl), apiKey: key.trim(), model: model.trim() }
    setBusy(true)
    setStatus({ ok: true, text: 'Checking the connection…' })
    try {
      await testAi(settings)
      await saveAiSettings(settings)
      setEditing(false)
      setStatus({ ok: true, text: 'Connected. The settings are saved on this device.' })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof AiError ? e.message : 'Something went wrong.' })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!confirm('Remove the AI settings from this device?')) return
    await clearAiSettings()
    setStatus(null)
  }

  const host = saved?.baseUrl ? safeHost(saved.baseUrl) : ''

  return (
    <Field label="AI assistant">
      <div className="store">
        {hasKey && !editing ? (
          <>
            <b>AI connected{host ? ` (${host}${saved?.model ? `, ${saved.model}` : ''})` : ''}.</b> The key is saved only in this browser and is not part of backups.
          </>
        ) : (
          <>
            Add the base URL, API key and model of your AI service (any OpenAI-compatible API). You find them in your AI provider's docs and account. They stay
            in this browser. When you use AI, the last 14 days of logs are sent to the AI service without names.
          </>
        )}
      </div>
      {editing || !hasKey ? (
        <>
          <input
            type="url"
            value={baseUrl}
            placeholder="Base URL, e.g. https://api.example.com/v1"
            aria-label="AI base URL"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <input
            type="password"
            value={key}
            placeholder="API key"
            aria-label="AI API key"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
          />
          <input type="text" value={model} aria-label="Model" placeholder="Model name" autoComplete="off" spellCheck={false} onChange={(e) => setModel(e.target.value)} />
          <div className="btn-row">
            <button className="btn2" onClick={save} disabled={busy}>
              {busy ? 'Checking…' : 'Save and connect'}
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
            Change
          </button>
          <button className="btn2 danger" onClick={remove}>
            Remove
          </button>
        </div>
      )}
      {status && <div className={status.ok ? 'ok-msg' : 'hint'}>{status.text}</div>}
    </Field>
  )
}

function safeHost(url: string) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
