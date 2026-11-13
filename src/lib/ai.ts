import { getSetting, setSetting } from './db'

/**
 * AI calls. The app talks straight from the browser to the AI service with your own key.
 * Any OpenAI-compatible service works: you set its base URL, key and model in Settings.
 * The key is stored only in this browser (IndexedDB) and is never part of a backup.
 * Every AI call goes through this file, so switching to another provider, or to a small
 * server that holds the key, means changing only this file.
 */

/** Used only for keys saved before the base URL field existed. */
const LEGACY_BASE_URL = 'https://api.deepseek.com'
const LEGACY_MODEL = 'deepseek-flash'
const AI_KEY = 'ai'

export interface AiSettings {
  apiKey: string
  /** OpenAI-compatible API address, e.g. https://api.example.com/v1 */
  baseUrl?: string
  model: string
}

/** Trim, drop trailing slashes and a pasted "/chat/completions". */
export function normalizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/+$/, '')
}

/** Returns a problem with the address, or '' when it looks fine. */
export function baseUrlProblem(url: string): string {
  const u = normalizeBaseUrl(url)
  if (!u) return 'Add the base URL of your AI service.'
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return 'The base URL must start with https://'
  } catch {
    return 'The base URL does not look right. It should look like https://api.example.com/v1'
  }
  return ''
}

const endpoint = (s: AiSettings) => `${normalizeBaseUrl(s.baseUrl || LEGACY_BASE_URL)}/chat/completions`

export const getAiSettings = () => getSetting<AiSettings>(AI_KEY)
export const saveAiSettings = (s: AiSettings) =>
  setSetting(AI_KEY, { apiKey: s.apiKey.trim(), baseUrl: normalizeBaseUrl(s.baseUrl ?? ''), model: s.model.trim() })
export const clearAiSettings = () => setSetting(AI_KEY, undefined)

export type AiErrorKind = 'nokey' | 'auth' | 'balance' | 'rate' | 'server' | 'network' | 'format' | 'request'

export class AiError extends Error {
  kind: AiErrorKind
  constructor(kind: AiErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** One chat request. Returns the reply text. */
export async function chat(messages: ChatMessage[], opts: { json?: boolean; maxTokens?: number; settings?: AiSettings } = {}): Promise<string> {
  const s = opts.settings ?? (await getAiSettings())
  if (!s?.apiKey) throw new AiError('nokey', 'Connect your AI service in Settings first.')
  let res: Response
  try {
    res = await fetch(endpoint(s), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
      body: JSON.stringify({
        model: s.model || (s.baseUrl ? '' : LEGACY_MODEL),
        messages,
        max_tokens: opts.maxTokens ?? 4000,
        stream: false,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
  } catch {
    throw new AiError(
      'network',
      'Could not reach the AI. Check your internet connection and the base URL. Some AI services do not allow calls straight from a browser.',
    )
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) throw new AiError('auth', 'The API key was not accepted. Check it in Settings.')
    if (res.status === 404) throw new AiError('request', 'The AI address or model was not found. Check the base URL and model in Settings.')
    if (res.status === 402) throw new AiError('balance', 'Your AI account has no balance left. Top it up with your AI provider.')
    if (res.status === 429) throw new AiError('rate', 'Too many requests. Wait a minute and try again.')
    if (res.status >= 500) throw new AiError('server', 'The AI service is busy or down. Try again in a moment.')
    throw new AiError('request', `The AI request failed (${res.status}). ${detail.slice(0, 200)}`)
  }
  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  if (!text.trim()) throw new AiError('format', 'The AI sent an empty answer. Try again.')
  return text
}

/** Cheap check that the key and model work. */
export async function testAi(settings: AiSettings): Promise<void> {
  await chat([{ role: 'user', content: 'Reply with the single word OK.' }], { settings, maxTokens: 20 })
}
