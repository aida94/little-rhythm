import { AiError, getAiSettings } from './ai'
import { parseSayAi } from './aiSay'
import { db } from './db'
import { improveEmojiLater, localEmoji } from './foodEmoji'
import { parseSay, type ParsedEntry } from './say'
import { uid } from './time'
import type { Entry, KidInfo } from './types'

/** Read a message: with the AI when connected, else (or if the AI fails) with the simple rules. */
export async function readMessage(
  text: string,
  kids: KidInfo[],
  current: KidInfo,
): Promise<{ entries: ParsedEntry[]; by: 'ai' | 'rules'; aiProblem?: string }> {
  if ((await getAiSettings())?.apiKey) {
    try {
      return { entries: await parseSayAi(text, kids, current), by: 'ai' }
    } catch (e) {
      return { entries: parseSay(text, kids, current), by: 'rules', aiProblem: e instanceof AiError ? e.message : 'The AI could not read this.' }
    }
  }
  return { entries: parseSay(text, kids, current), by: 'rules' }
}

/** Save read entries to the log. Food gets emoji (built-in now, AI later). Returns the saved entries. */
export async function addParsed(parsed: ParsedEntry[]): Promise<Entry[]> {
  const later: string[] = []
  const rows: Entry[] = parsed.map(({ said: _said, ...e }) => {
    const row: Entry = { ...e, id: uid(), details: { ...e.details } }
    if (row.type === 'feed' && row.details.food && !row.details.emoji) {
      const emoji = localEmoji(row.details.food)
      if (emoji) row.details.emoji = emoji
      later.push(row.id) // the AI may find better emoji afterwards
    }
    return row
  })
  await db.entries.bulkAdd(rows)
  later.forEach((id) => void improveEmojiLater(id))
  return rows
}
