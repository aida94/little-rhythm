import { useEffect, useRef, useState } from 'react'
import { addParsed, readMessage } from '../lib/sayStore'
import { listen, type ListenError, type Listener } from '../lib/speech'
import type { Entry, KidInfo } from '../lib/types'
import { Icon } from './Icons'

type Phase = { step: 'listening'; text: string } | { step: 'reading'; text: string; ai: boolean } | { step: 'problem'; text: string; message: string }

const LISTEN_PROBLEM: Record<ListenError, string> = {
  denied: 'The app may not use the microphone. Allow it in your browser settings, or type instead.',
  'no-speech': "I didn't hear anything. Try again, a bit closer to the phone.",
  network: 'Speech recognition needs the internet. Check your connection, or type instead.',
  other: 'Listening did not work. Try again, or type instead.',
}

/**
 * Say it, by voice: listens right away over a see-through layer on top of Today,
 * then the AI (or the simple rules) reads what was said and the entries are added straight to the log.
 */
export function VoiceOverlay({
  kid,
  kids,
  aiOn,
  onAdded,
  onTypeInstead,
  onClose,
}: {
  kid: KidInfo
  kids: KidInfo[]
  aiOn: boolean
  onAdded: (rows: Entry[], note: string) => void
  onTypeInstead: (text: string) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ step: 'listening', text: '' })
  const [round, setRound] = useState(0)
  const listener = useRef<Listener | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    const read = async (text: string) => {
      if (!text) return setPhase({ step: 'problem', text, message: LISTEN_PROBLEM['no-speech'] })
      setPhase({ step: 'reading', text, ai: aiOn })
      const { entries, by, aiProblem } = await readMessage(text, kids, kid)
      if (!alive.current) return
      if (!entries.length)
        return setPhase({ step: 'problem', text, message: aiProblem ? `${aiProblem} Nothing was added.` : 'I could not find anything to log in that. Try saying it another way.' })
      const rows = await addParsed(entries)
      if (!alive.current) return
      onAdded(rows, by === 'rules' && aiProblem ? 'AI unavailable, simple rules used' : '')
    }
    listener.current = listen({
      onText: (text) => setPhase({ step: 'listening', text }),
      onEnd: (text) => void read(text),
      onError: (e) => setPhase((p) => ({ step: 'problem', text: p.text, message: LISTEN_PROBLEM[e] })),
    })
    return () => listener.current?.cancel()
    // `round` restarts listening for "Try again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  const cancel = () => {
    listener.current?.cancel()
    onClose()
  }

  return (
    <div className="voice" role="dialog" aria-modal="true" aria-label="Say it">
      <div className="voice-card">
        {phase.step === 'listening' && (
          <>
            <div className="voice-orb listening" aria-hidden="true">
              <Icon name="mic" />
            </div>
            <b className="voice-title">Listening…</b>
            <p className={`voice-text${phase.text ? '' : ' muted'}`} aria-live="polite">
              {phase.text || `Tell me what ${kid.name}${kids.length > 1 ? ' or the others' : ''} did. For example: "napped from 1 to 2:30, then had a banana".`}
            </p>
            <div className="voice-actions">
              <button className="btn2" onClick={cancel}>
                Cancel
              </button>
              <button className="voice-done" onClick={() => listener.current?.finish()} disabled={!phase.text}>
                Done
              </button>
            </div>
            <button
              className="voice-link"
              onClick={() => {
                listener.current?.cancel()
                onTypeInstead(phase.text)
              }}
            >
              Type instead
            </button>
          </>
        )}
        {phase.step === 'reading' && (
          <>
            <div className="voice-orb reading" aria-hidden="true">
              <span className="voice-spinner" />
            </div>
            <b className="voice-title">{phase.ai ? 'AI is reading…' : 'Reading…'}</b>
            <p className="voice-text" aria-live="polite">
              “{phase.text}”
            </p>
          </>
        )}
        {phase.step === 'problem' && (
          <>
            <div className="voice-orb problem" aria-hidden="true">
              <Icon name="mic" />
            </div>
            <p className="voice-text" role="alert">
              {phase.message}
            </p>
            {phase.text && <p className="voice-text muted">“{phase.text}”</p>}
            <div className="voice-actions">
              <button className="btn2" onClick={() => onTypeInstead(phase.text)}>
                Type instead
              </button>
              <button
                className="voice-done"
                onClick={() => {
                  setPhase({ step: 'listening', text: '' })
                  setRound((r) => r + 1)
                }}
              >
                Try again
              </button>
            </div>
            <button className="voice-link" onClick={cancel}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}
