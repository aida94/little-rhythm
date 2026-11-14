/**
 * Speech to text with the browser's own speech recognition (Chrome, Edge, Safari, Android).
 * No AI and no key: the browser does the listening. Stops by itself after a short silence.
 */

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

const Ctor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canListen = () => typeof window !== 'undefined' && !!Ctor()

export type ListenError = 'denied' | 'no-speech' | 'network' | 'other'

export interface Listener {
  /** Stop listening and use what was heard. */
  finish: () => void
  /** Stop listening and throw away what was heard. */
  cancel: () => void
}

/** Start listening. `onText` gets the words so far; `onEnd` gets the final text once. */
export function listen(opts: {
  onText: (text: string) => void
  onEnd: (text: string) => void
  onError: (e: ListenError) => void
  silenceMs?: number
  lang?: string
}): Listener {
  const C = Ctor()
  if (!C) {
    opts.onError('other')
    return { finish: () => {}, cancel: () => {} }
  }
  const rec = new C()
  rec.lang = opts.lang ?? navigator.language ?? 'en-US'
  rec.continuous = true
  rec.interimResults = true

  let finalText = ''
  let interim = ''
  let ended = false
  let cancelled = false
  let failed = false
  let silence: number | undefined
  const full = () => `${finalText} ${interim}`.replace(/\s+/g, ' ').trim()
  const armSilence = () => {
    clearTimeout(silence)
    silence = window.setTimeout(() => rec.stop(), opts.silenceMs ?? 2500)
  }

  rec.onresult = (e) => {
    interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) finalText += ' ' + r[0].transcript
      else interim += ' ' + r[0].transcript
    }
    opts.onText(full())
    armSilence()
  }
  rec.onerror = (e) => {
    if (e.error === 'aborted') return
    failed = true
    opts.onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'no-speech' : e.error === 'network' ? 'network' : 'other')
  }
  rec.onend = () => {
    clearTimeout(silence)
    if (ended) return
    ended = true
    if (!cancelled && !failed) opts.onEnd(full())
  }

  try {
    rec.start()
  } catch {
    opts.onError('other')
  }
  // Nothing said at all: stop after a longer wait.
  silence = window.setTimeout(() => rec.stop(), 8000)

  return {
    finish: () => rec.stop(),
    cancel: () => {
      cancelled = true
      clearTimeout(silence)
      rec.abort()
    },
  }
}
